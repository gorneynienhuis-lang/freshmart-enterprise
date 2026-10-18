package com.freshmart.identity;

import com.freshmart.command.IdempotencyService;
import com.freshmart.common.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.ObjectMapper;
import static com.freshmart.identity.EmployeeModels.*;

@RestController @RequestMapping("/api/v1/admin")
public class EmployeeController {
 private final EmployeeService service;private final IdempotencyService commands;private final ObjectMapper json;
 public EmployeeController(EmployeeService service,IdempotencyService commands,ObjectMapper json){this.service=service;this.commands=commands;this.json=json;}
 @GetMapping("/employees") public ApiEnvelope<?> list(@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int size){return ApiEnvelope.ok(service.list(RequestActor.current(),page,size));}
 @GetMapping("/roles") public ApiEnvelope<?> roles(){return ApiEnvelope.ok(service.roles(RequestActor.current()));}
 @PostMapping("/employees") @ResponseStatus(HttpStatus.CREATED)
 public ApiEnvelope<?> create(@Valid @RequestBody Create body,HttpServletRequest r){
  // The ledger retains only the final request digest; the plaintext password is
  // replaced with its one-way digest before canonicalization and never logged.
  var canonical=new Create(body.phone(),body.displayName(),TokenCodec.hash(body.temporaryPassword()),body.roles());
  return ApiEnvelope.ok(commands.execute(RequestActor.current().userId(),"POST /api/v1/admin/employees",CommandHeaders.requireIdempotencyKey(r),json.writeValueAsString(canonical),Employee.class,()->service.create(RequestActor.current(),body)));
 }
 @PutMapping("/employees/{employeeId}/roles") public ApiEnvelope<?> roles(@PathVariable String employeeId,@Valid @RequestBody Roles body,HttpServletRequest r){return ApiEnvelope.ok(commands.execute(RequestActor.current().userId(),"PUT "+r.getRequestURI(),CommandHeaders.requireIdempotencyKey(r),json.writeValueAsString(body),Employee.class,()->service.setRoles(RequestActor.current(),employeeId,body)));}
 @PutMapping("/employees/{employeeId}/status") public ApiEnvelope<?> status(@PathVariable String employeeId,@Valid @RequestBody Status body,HttpServletRequest r){return ApiEnvelope.ok(commands.execute(RequestActor.current().userId(),"PUT "+r.getRequestURI(),CommandHeaders.requireIdempotencyKey(r),json.writeValueAsString(body),Employee.class,()->service.setStatus(RequestActor.current(),employeeId,body)));}
}
