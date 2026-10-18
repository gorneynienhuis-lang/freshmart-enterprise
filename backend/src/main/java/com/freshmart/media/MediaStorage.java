package com.freshmart.media;
import com.freshmart.common.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.UUID;

@Component public class MediaStorage {
 private final Path root;
 public MediaStorage(@Value("${app.media-dir:./.runtime/media}")String configured){
  root=Path.of(configured).toAbsolutePath().normalize();
  if(root.toString().replace('\\','/').matches(".*(?:/static|/public)(?:/.*)?"))throw new IllegalStateException("Private media must not use a static/public web root");
  try{Files.createDirectories(root);if(Files.isSymbolicLink(root))throw new IllegalStateException("Media root must not be a symbolic link");try{Files.setPosixFilePermissions(root,PosixFilePermissions.fromString("rwx------"));}catch(UnsupportedOperationException ignored){}}catch(IOException e){throw new IllegalStateException("Media storage unavailable",e);}
 }
 public String put(String scope,byte[] bytes){
  if(!scope.matches("private|product|review-public"))throw new IllegalArgumentException("Invalid storage scope");
  String key=scope+"/"+UUID.randomUUID()+".raster";Path target=resolve(key),temporary=null;
  try{
   Files.createDirectories(target.getParent());try{Files.setPosixFilePermissions(target.getParent(),PosixFilePermissions.fromString("rwx------"));}catch(UnsupportedOperationException ignored){}temporary=Files.createTempFile(target.getParent(),"pending-",".tmp");
   try{Files.setPosixFilePermissions(temporary,PosixFilePermissions.fromString("rw-------"));}catch(UnsupportedOperationException ignored){}
   Files.write(temporary,bytes,StandardOpenOption.WRITE,StandardOpenOption.TRUNCATE_EXISTING);Files.move(temporary,target,StandardCopyOption.ATOMIC_MOVE);
   if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)try{Files.deleteIfExists(target);}catch(IOException ignored){}}});
   return key;
  }catch(IOException e){if(temporary!=null)try{Files.deleteIfExists(temporary);}catch(IOException ignored){}throw new ApiException(503,1050,"STORAGE_UNAVAILABLE","图片存储暂不可用");}
 }
 public byte[] read(String key){
  Path path=resolve(key);try{if(!Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)||Files.size(path)>ImageSanitizer.MAX_BYTES)throw ApiException.notFound();return Files.readAllBytes(path);}catch(IOException e){throw ApiException.notFound();}
 }
 private Path resolve(String key){if(key==null||!key.matches("(?:private|product|review-public)/[a-f0-9-]{36}\\.raster"))throw ApiException.notFound();Path result=root.resolve(key).normalize();if(!result.startsWith(root)||Files.isSymbolicLink(result.getParent()))throw ApiException.notFound();return result;}
}
