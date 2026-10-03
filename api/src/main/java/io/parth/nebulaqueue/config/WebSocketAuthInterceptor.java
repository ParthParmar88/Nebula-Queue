package io.parth.nebulaqueue.config;

import java.security.Principal;
import java.util.Set;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.JwtException;
import io.parth.nebulaqueue.util.JwtUtil;
import lombok.RequiredArgsConstructor;

/**
 * Secures the STOMP layer (the HTTP handshake on /ws is open, since browsers can't send
 * headers on it):
 * <ul>
 *   <li>CONNECT must carry {@code Authorization: Bearer <jwt>}; the user becomes the session principal.</li>
 *   <li>SUBSCRIBE is only allowed to the caller's own queue, or the admin topic for admins.</li>
 *   <li>SEND is rejected — clients only listen; otherwise they could publish fake updates to the broker.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    /** The caller's own queues; Spring resolves them to the current session's user. */
    private static final Set<String> USER_DESTINATIONS = Set.of(
            "/user" + JobStatusPublisher.USER_QUEUE,
            "/user" + JobStatusPublisher.USER_STREAM_QUEUE);

    private static final Set<String> ADMIN_DESTINATIONS = Set.of(
            JobStatusPublisher.ADMIN_TOPIC,
            JobStatusPublisher.ADMIN_STREAM_TOPIC);

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT) {
            accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
        } else if (command == StompCommand.SUBSCRIBE) {
            authorizeSubscription(accessor.getUser(), accessor.getDestination());
        } else if (command == StompCommand.SEND) {
            throw new AccessDeniedException("Sending messages is not allowed");
        }
        return message;
    }

    private Authentication authenticate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("Missing bearer token");
        }
        String token = authHeader.substring(7);
        try {
            UserDetails user = userDetailsService.loadUserByUsername(jwtUtil.extractUsername(token));
            if (!jwtUtil.isTokenValid(token, user)) {
                throw new AccessDeniedException("Invalid token");
            }
            return new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        } catch (JwtException | UsernameNotFoundException e) {
            throw new AccessDeniedException("Invalid token");
        }
    }

    private static void authorizeSubscription(Principal principal, String destination) {
        if (!(principal instanceof Authentication auth) || destination == null) {
            throw new AccessDeniedException("Not authenticated");
        }
        if (USER_DESTINATIONS.contains(destination)) {
            return;
        }
        if (ADMIN_DESTINATIONS.contains(destination) && isAdmin(auth)) {
            return;
        }
        throw new AccessDeniedException("Cannot subscribe to " + destination);
    }

    private static boolean isAdmin(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
