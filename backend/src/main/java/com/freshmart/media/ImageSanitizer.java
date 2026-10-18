package com.freshmart.media;

import com.freshmart.common.ApiException;
import org.springframework.stereotype.Component;
import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Arrays;
import java.util.concurrent.Semaphore;

/** Bounded image parsing and pixel re-encoding; no external antivirus service is claimed. */
@Component public class ImageSanitizer {
 public static final int MAX_BYTES=6*1024*1024,MAX_SIDE=6000;
 public static final long MAX_PIXELS=12_000_000L;
 private final Semaphore decoders=new Semaphore(2);
 public record Raster(byte[] bytes,String mimeType,int width,int height){}
 public Raster clean(byte[] source,String declaredMime){
  if(source==null||source.length==0||source.length>MAX_BYTES)throw ApiException.invalid("图片须为1字节至6MiB");
  String actual=magic(source);if(!actual.equals(declaredMime))throw ApiException.invalid("图片实际格式与声明类型不一致");
  if("image/webp".equals(actual)){
   long declared=le32(source,4);if(declared+8!=source.length)throw ApiException.invalid("WebP容器长度不合法");
   for(long position=12;position+8<=source.length;){int at=(int)position;long size=le32(source,at+4);if(position+8+size>source.length)throw ApiException.invalid("WebP块长度不合法");if(source[at]=='A'&&source[at+1]=='N'&&source[at+2]=='I'&&source[at+3]=='M')throw ApiException.invalid("仅接受静态单帧图片");position+=8+size+(size&1);}
  }
  if(!decoders.tryAcquire())throw new ApiException(429,1029,"RATE_LIMITED","图片处理繁忙，请稍后重试");
  try(var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(source))){
   var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw ApiException.invalid("图片格式不可解码");var reader=readers.next();
   try{
    reader.setInput(input,false,true);int width=reader.getWidth(0),height=reader.getHeight(0);
    if(width<1||height<1||width>MAX_SIDE||height>MAX_SIDE||(long)width*height>MAX_PIXELS)throw ApiException.invalid("图片边长最多6000像素，总像素最多1200万");
    if(reader.getNumImages(true)!=1)throw ApiException.invalid("仅接受静态单帧图片");
    BufferedImage decoded=reader.read(0);if(decoded==null||decoded.getWidth()!=width||decoded.getHeight()!=height)throw ApiException.invalid("图片解码失败");
    boolean jpeg="image/jpeg".equals(actual);BufferedImage pixels=new BufferedImage(width,height,jpeg?BufferedImage.TYPE_INT_RGB:BufferedImage.TYPE_INT_ARGB);
    Graphics2D graphics=pixels.createGraphics();try{graphics.drawImage(decoded,0,0,null);}finally{graphics.dispose();decoded.flush();}
    var output=new ByteArrayOutputStream();if(!ImageIO.write(pixels,jpeg?"JPEG":"PNG",output))throw ApiException.invalid("图片重编码失败");pixels.flush();
    byte[] bytes=output.toByteArray();if(bytes.length>MAX_BYTES)throw ApiException.invalid("净化后的图片超过6MiB，请缩小图片");
    return new Raster(bytes,jpeg?"image/jpeg":"image/png",width,height);
   }finally{reader.dispose();}
  }catch(ApiException e){throw e;}catch(IOException|RuntimeException e){throw ApiException.invalid("图片内容损坏或不支持，请重新导出JPEG、PNG或WebP");}
  finally{decoders.release();}
 }
 private static String magic(byte[] b){
  if(b.length>=8&&Arrays.equals(Arrays.copyOf(b,8),new byte[]{(byte)137,80,78,71,13,10,26,10}))return "image/png";
  if(b.length>=3&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255)return "image/jpeg";
  if(b.length>=12&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P')return "image/webp";
  throw ApiException.invalid("仅允许实际JPEG、PNG或WebP图片，不接受SVG、HTML或伪扩展名");
 }
 private static long le32(byte[] bytes,int offset){return (bytes[offset]&255L)|((bytes[offset+1]&255L)<<8)|((bytes[offset+2]&255L)<<16)|((bytes[offset+3]&255L)<<24);}
}
