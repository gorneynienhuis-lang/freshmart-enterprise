import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import org.h2.tools.RunScript;

/** Reproducible H2 constraint probe; not a MySQL validation or an additional JUnit suite. */
class SchemaConstraintProbe {
    static int rejected;
    static void reject(Connection c, String label, String sql) throws Exception {
        try (var s = c.createStatement()) {
            s.executeUpdate(sql);
            throw new AssertionError("Invalid value was accepted: " + label);
        } catch (SQLException expected) {
            if (!"23513".equals(expected.getSQLState())) throw expected;
            rejected++;
            System.out.println("REJECTED " + label + " SQLState=" + expected.getSQLState());
        }
    }
    public static void main(String[] args) throws Exception {
        try (var c = DriverManager.getConnection("jdbc:h2:mem:constraints;MODE=MySQL");
             var reader = Files.newBufferedReader(Path.of(args[0]));
             var s = c.createStatement()) {
            RunScript.execute(c, reader);
            s.executeUpdate("INSERT INTO fm_category(category_id,code,name,short_name,image_url) VALUES('c','c','category','c','/c.jpg')");
            s.executeUpdate("INSERT INTO fm_product(product_id,spu_code,category_id,name,description,origin,storage,image_url) VALUES('p','p','c','product','demo','demo','COLD','/p.jpg')");
            s.executeUpdate("INSERT INTO fm_sku(sku_id,sku_code,product_id,name,unit_label,base_unit,price_mode,price_unit_gram,price,member_price,image_url) VALUES('s','s','p','sku','500g','GRAM','BY_WEIGHT',500,100,90,'/s.jpg')");
            reject(c, "weight denominator NULL", "UPDATE fm_sku SET price_unit_gram=NULL WHERE sku_id='s'");
            reject(c, "weight denominator beyond safe integer", "UPDATE fm_sku SET price_unit_gram=9007199254740992 WHERE sku_id='s'");
            s.executeUpdate("INSERT INTO fm_inventory_batch(batch_id,sku_id,batch_no,warehouse_id,received_at,expires_at,lifecycle_status,on_hand,reserved,quarantined) VALUES('b','s','b','w',TIMESTAMP '2026-10-18 00:00:00',TIMESTAMP '2026-10-20 00:00:00','NORMAL',10,1,0)");
            reject(c, "quarantined batch retaining reservation", "UPDATE fm_inventory_batch SET lifecycle_status='QUARANTINED' WHERE batch_id='b'");
            reject(c, "disposed batch retaining physical stock", "UPDATE fm_inventory_batch SET lifecycle_status='DISPOSED' WHERE batch_id='b'");
            s.executeUpdate("UPDATE fm_inventory_batch SET lifecycle_status='QUARANTINED',reserved=0,quarantined=10 WHERE batch_id='b'");
            s.executeUpdate("UPDATE fm_inventory_batch SET lifecycle_status='DISPOSED',on_hand=0,quarantined=0 WHERE batch_id='b'");
            if (rejected != 4) throw new AssertionError("Expected four rejected writes");
            System.out.println("PASS: 4 invalid writes rejected; valid weight, NORMAL, whole QUARANTINED, and zero DISPOSED states accepted.");
            System.out.println("Engine: " + c.getMetaData().getDatabaseProductName() + " " + c.getMetaData().getDatabaseProductVersion());
        }
    }
}
