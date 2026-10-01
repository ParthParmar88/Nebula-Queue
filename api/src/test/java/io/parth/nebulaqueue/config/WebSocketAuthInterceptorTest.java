package io.parth.nebulaqueue.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.Principal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.util.ReflectionTestUtils;

import io.parth.nebulaqueue.model.Role;
import io.parth.nebulaqueue.model.User;
import io.parth.nebulaqueue.util.JwtUtil;

class WebSocketAuthInterceptorTest {

    private JwtUtil jwtUtil;
    private WebSocketAuthInterceptor interceptor;
    private User alice;
    private User admin;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "test-secret-that-is-at-least-32-bytes-long!!");
        ReflectionTestUtils.setField(jwtUtil, "expiration", 60_000L);

        alice = user("alice@example.com", Role.USER);
        admin = user("admin@example.com", Role.ADMIN);

        interceptor = new WebSocketAuthInterceptor(jwtUtil, username -> switch (username) {
            case "alice@example.com" -> alice;
            case "admin@example.com" -> admin;
            default -> throw new UsernameNotFoundException(username);
        });
    }

    // ── CONNECT ──────────────────────────────────────────────────────────────

    @Test
    void connectWithValidTokenSetsTheUser() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.addNativeHeader("Authorization", "Bearer " + jwtUtil.generateToken(alice));

        Message<?> result = interceptor.preSend(message(accessor), null);

        Principal user = StompHeaderAccessor.wrap(result).getUser();
        assertThat(user).isNotNull();
        assertThat(user.getName()).isEqualTo("alice@example.com");
    }

    @Test
    void connectWithoutTokenIsRejected() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);

        assertThatThrownBy(() -> interceptor.preSend(message(accessor), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void connectWithForgedTokenIsRejected() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.addNativeHeader("Authorization", "Bearer not.a.jwt");

        assertThatThrownBy(() -> interceptor.preSend(message(accessor), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── SUBSCRIBE ────────────────────────────────────────────────────────────

    @Test
    void userCanSubscribeToOwnQueue() {
        interceptor.preSend(subscribe(alice, "/user/queue/jobs"), null);
    }

    @Test
    void userCannotSubscribeToAdminTopic() {
        assertThatThrownBy(() -> interceptor.preSend(subscribe(alice, "/topic/admin/jobs"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void adminCanSubscribeToAdminTopic() {
        interceptor.preSend(subscribe(admin, "/topic/admin/jobs"), null);
    }

    @Test
    void cannotSubscribeToArbitraryDestinations() {
        // e.g. another session's resolved user queue
        assertThatThrownBy(() -> interceptor.preSend(subscribe(admin, "/queue/jobs-user123"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void anonymousCannotSubscribe() {
        assertThatThrownBy(() -> interceptor.preSend(subscribe(null, "/user/queue/jobs"), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── SEND ─────────────────────────────────────────────────────────────────

    @Test
    void clientsCannotPublishMessages() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setDestination("/topic/admin/jobs");
        accessor.setUser(auth(admin));

        assertThatThrownBy(() -> interceptor.preSend(message(accessor), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static User user(String email, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("irrelevant");
        user.setRole(role);
        return user;
    }

    private static UsernamePasswordAuthenticationToken auth(User user) {
        return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
    }

    private static Message<byte[]> subscribe(User user, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        if (user != null) {
            accessor.setUser(auth(user));
        }
        return message(accessor);
    }

    private static Message<byte[]> message(StompHeaderAccessor accessor) {
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
