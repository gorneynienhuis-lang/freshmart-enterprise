package com.freshmart.common;
import java.util.UUID;
public final class TraceContext {
  private static final ThreadLocal<String> CURRENT=new ThreadLocal<>();
  private TraceContext(){}
  public static String id(){String id=CURRENT.get();return id==null?UUID.randomUUID().toString():id;}
  static void set(String id){CURRENT.set(id);} static void clear(){CURRENT.remove();}
}
