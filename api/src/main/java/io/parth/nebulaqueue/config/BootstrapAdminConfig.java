package io.parth.nebulaqueue.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import io.parth.nebulaqueue.model.Role;
import io.parth.nebulaqueue.model.User;
import io.parth.nebulaqueue.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Optionally creates a default admin when {@code app.bootstrap-admin.email} and
 * {@code app.bootstrap-admin.password} are set (e.g. in Docker Compose for local MVP).
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class BootstrapAdminConfig {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    ApplicationRunner bootstrapAdmin(
            @Value("${app.bootstrap-admin.email:}") String email,
            @Value("${app.bootstrap-admin.password:}") String password) {
        return args -> {
            if (email == null || email.isBlank() || password == null || password.isBlank()) {
                return;
            }
            String trimmed = email.trim();
            if (userRepository.findByEmail(trimmed).isPresent()) {
                return;
            }
            User admin = new User();
            admin.setEmail(trimmed);
            admin.setPassword(passwordEncoder.encode(password));
            admin.setRole(Role.ADMIN);
            userRepository.save(admin);
            log.info("Bootstrap: created admin user {}", trimmed);
        };
    }
}
