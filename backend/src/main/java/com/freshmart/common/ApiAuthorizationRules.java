package com.freshmart.common;
import org.springframework.core.io.ClassPathResource;import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;import java.util.*;import java.util.regex.Pattern;
/** Global operation-role boundary, generated from the reviewed contract. Resource scope remains in services. */
@Component
public class ApiAuthorizationRules {
 private final List<Rule> rules=new ArrayList<>();
 public ApiAuthorizationRules(ObjectMapper json)throws IOException{try(var input=new ClassPathResource("api-access-rules.json").getInputStream()){for(var item:json.readTree(input).path("rules")){String path=item.path("path").asString();StringBuilder regex=new StringBuilder("^");for(String segment:path.split("/",-1)){if(!regex.toString().equals("^"))regex.append('/');if(segment.startsWith("{")&&segment.endsWith("}"))regex.append("[A-Za-z0-9_-]{1,64}");else regex.append(Pattern.quote(segment));}regex.append('$');Set<String>roles=new HashSet<>();for(var role:item.path("roles"))roles.add(role.asString());rules.add(new Rule(item.path("method").asString(),Pattern.compile(regex.toString()),Set.copyOf(roles)));}}}
 public void authorize(String method,String path,RequestActor actor){if(!path.startsWith("/api/"))return;for(Rule rule:rules){if(rule.method.equals(method)&&rule.path.matcher(path).matches()){if(rule.roles.contains("GUEST"))return;if(actor==null)throw ApiException.unauthorized();if(rule.roles.stream().noneMatch(actor.roles()::contains))throw ApiException.forbidden();return;}}throw ApiException.notFound();}
 private record Rule(String method,Pattern path,Set<String>roles){}
}
