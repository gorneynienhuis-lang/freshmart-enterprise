package com.freshmart.operations;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.freshmart.operations.OperationsModels.*;

/** No in-memory policy cache: committed operator changes affect new catalogue/checkout reads. */
@Service
public class BusinessPolicyService {
 private final OperationsMapper mapper;
 public BusinessPolicyService(OperationsMapper mapper){this.mapper=mapper;}
 @Transactional(readOnly=true) public Policies current(){return require(mapper.policies(false));}
 @Transactional public Policies lockCurrent(){return require(mapper.policies(true));}
 private Policies require(Policies value){if(value==null)throw new IllegalStateException("Business policy migration is missing");return value;}
}
