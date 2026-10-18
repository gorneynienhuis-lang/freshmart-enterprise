package com.freshmart.observability;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import static org.junit.jupiter.api.Assertions.*;

class MetricsScrapeAuthTest {
    @TempDir Path temp;
    private static final String TOKEN="synthetic_MetricsCredential_2026_never_runtime_0123456789";
    private Path tokenFile(String name)throws Exception {
        Path file=temp.toRealPath().resolve(name);Files.writeString(file,TOKEN+"\n");
        Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));return file;
    }
    @Test void acceptsOnlyExactReadOnlyExpositionAndNeverAnApplicationIdentity()throws Exception {
        var auth=new MetricsScrapeAuth(true,tokenFile("credential").toString());
        assertTrue(auth.accepts("GET","/actuator/prometheus","Bearer "+TOKEN));
        for(String path:new String[]{"/api/v1/auth/me","/api/v1/admin/employees","/actuator/info","/actuator/prometheus/","/actuator/prometheusX"})
            assertFalse(auth.accepts("GET",path,"Bearer "+TOKEN));
        for(String method:new String[]{"POST","PUT","HEAD","OPTIONS"})assertFalse(auth.accepts(method,"/actuator/prometheus","Bearer "+TOKEN));
        for(String header:new String[]{"Bearer "+TOKEN+"x","Bearer wrong","Basic "+TOKEN,"bearer "+TOKEN,"Bearer "+"x".repeat(1000)})
            assertFalse(auth.accepts("GET","/actuator/prometheus",header));
        assertFalse(auth.accepts("GET","/actuator/prometheus",null));
        assertFalse(new MetricsScrapeAuth(false,"/nonexistent").accepts("GET","/actuator/prometheus","Bearer "+TOKEN));
    }
    @Test void enabledModeRejectsUnsafeFilesWithoutLeakingPathOrCredential()throws Exception {
        Path file=tokenFile("private");Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-r--r--"));reject(file);
        Files.setPosixFilePermissions(file,PosixFilePermissions.fromString("rw-------"));
        Path link=temp.toRealPath().resolve("link");Files.createSymbolicLink(link,file);reject(link);
        Path directory=Files.createDirectory(temp.toRealPath().resolve("directory"));reject(directory);
        Path parentLink=temp.toRealPath().resolve("parent-link");Files.createSymbolicLink(parentLink,directory);
        Path nested=directory.resolve("nested");Files.writeString(nested,TOKEN);Files.setPosixFilePermissions(nested,PosixFilePermissions.fromString("rw-------"));reject(parentLink.resolve("nested"));
        Files.writeString(file,"short");reject(file);Files.writeString(file,"x".repeat(257));reject(file);
        Files.writeString(file,"\u4e1c".repeat(43));reject(file);reject(temp.resolve("missing"));
        assertThrows(IllegalStateException.class,()->new MetricsScrapeAuth(true,""));
    }
    private void reject(Path path){var failure=assertThrows(IllegalStateException.class,()->new MetricsScrapeAuth(true,path.toString()));assertEquals("Monitoring credential file is missing or unsafe",failure.getMessage());assertNull(failure.getCause());}
}
