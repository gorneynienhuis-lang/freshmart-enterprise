package com.freshmart.identity;
import jakarta.servlet.http.Cookie;import jakarta.servlet.http.HttpServletRequest;
final class Cookies {
 private Cookies(){}static String get(HttpServletRequest request,String name){if(request.getCookies()!=null)for(Cookie cookie:request.getCookies())if(name.equals(cookie.getName()))return cookie.getValue();return null;}
}
