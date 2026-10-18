-- Separate employee identity from shopping membership. A normal member cannot be
-- taken over through the employee administration endpoints.
CREATE TABLE fm_employee (
 employee_id VARCHAR(64) PRIMARY KEY,
 user_id VARCHAR(64) NOT NULL UNIQUE,
 created_at TIMESTAMP(6) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES fm_user(user_id)
);
INSERT INTO fm_employee(employee_id,user_id,created_at)
 SELECT DISTINCT u.user_id,u.user_id,u.created_at FROM fm_user u
 JOIN fm_user_role r ON r.user_id=u.user_id WHERE r.role_code <> 'MEMBER';

-- All employee governance commands take this persistent mutex before locking
-- either actor or target; multiple app instances preserve the final active admin.
CREATE TABLE fm_employee_governance_lock (
 lock_id INT PRIMARY KEY,
 CONSTRAINT ck_employee_governance_lock CHECK(lock_id=1)
);
INSERT INTO fm_employee_governance_lock(lock_id) VALUES(1);
