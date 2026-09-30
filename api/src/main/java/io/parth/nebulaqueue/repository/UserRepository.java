package io.parth.nebulaqueue.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import io.parth.nebulaqueue.model.User;
import java.util.Optional;


public interface UserRepository extends JpaRepository<User, Long> {

  Optional<User> findByEmail(String email);

}