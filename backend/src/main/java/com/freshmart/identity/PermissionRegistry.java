package com.freshmart.identity;
import org.springframework.core.io.ClassPathResource;import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;import java.util.*;
@Component
public class PermissionRegistry {
 private final Map<String,Set<String>> roles=new HashMap<>();
 public PermissionRegistry(ObjectMapper mapper)throws IOException{try(var stream=new ClassPathResource("role-permissions.json").getInputStream()){var tree=mapper.readTree(stream).path("roles");tree.properties().forEach(e->{Set<String> values=new TreeSet<>();for(var key:e.getValue())values.add(key.asString());roles.put(e.getKey(),Set.copyOf(values));});}}
 public Set<String> permissions(Collection<String> assigned){Set<String>result=new TreeSet<>();for(String role:assigned)result.addAll(roles.getOrDefault(role,Set.of()));return Set.copyOf(result);}
}
