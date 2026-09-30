package io.parth.nebulaqueue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class NebulaQueueApplication {

	public static void main(String[] args) {
		SpringApplication.run(NebulaQueueApplication.class, args);

		System.out.println("**********************************" + java.util.TimeZone.getDefault().getID());
	}

}
