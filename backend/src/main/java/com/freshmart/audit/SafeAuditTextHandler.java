package com.freshmart.audit;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import java.sql.*;

public class SafeAuditTextHandler extends BaseTypeHandler<String> {
    @Override public void setNonNullParameter(PreparedStatement ps, int index, String value, JdbcType type) throws SQLException { ps.setString(index, SafeAuditText.redact(value)); }
    @Override public String getNullableResult(ResultSet rs, String column) throws SQLException { return SafeAuditText.redact(rs.getString(column)); }
    @Override public String getNullableResult(ResultSet rs, int index) throws SQLException { return SafeAuditText.redact(rs.getString(index)); }
    @Override public String getNullableResult(CallableStatement cs, int index) throws SQLException { return SafeAuditText.redact(cs.getString(index)); }
}
