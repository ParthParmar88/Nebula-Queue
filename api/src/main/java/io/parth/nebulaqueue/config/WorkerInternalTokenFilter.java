package io.parth.nebulaqueue.config;

import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Authenticates the background worker for PATCH requests to
 * {@code /internal/worker/jobs/{id}/status} using the {@code X-Worker-Token} header,
 * without requiring a user JWT.
 */
@Component
public class WorkerInternalTokenFilter extends OncePerRequestFilter {

    private static final Pattern WORKER_STATUS_PATCH =
            Pattern.compile("^/internal/worker/jobs/[^/]+/status$");

    @Value("${app.worker.internal-token:}")
    private String expectedToken;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (!"PATCH".equalsIgnoreCase(request.getMethod())
                || !matchesWorkerStatusPath(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (expectedToken == null || expectedToken.isBlank()) {
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                    "Worker internal token is not configured (app.worker.internal-token)");
            return;
        }

        String presented = request.getHeader("X-Worker-Token");
        if (presented == null || !expectedToken.equals(presented)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid worker token");
            return;
        }

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "worker", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);

        filterChain.doFilter(request, response);
    }

    private static boolean matchesWorkerStatusPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && uri.startsWith(context)) {
            uri = uri.substring(context.length());
        }
        return WORKER_STATUS_PATCH.matcher(uri).matches();
    }
}
