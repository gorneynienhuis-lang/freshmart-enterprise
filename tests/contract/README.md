# 契约校验

快速零依赖校验：`node scripts/validate-contract.mjs`。

独立标准校验：创建隔离Python环境，`pip install -r tests/contract/requirements-contract.txt`，执行 `python tests/contract/verify_openapi.py`。该脚本验证OpenAPI标准以及请求/响应示例的JSON Schema与格式；multipart示例只是字段形状，不是实际二进制上传测试。

校验通过不证明接口已实现、业务算账正确、权限运行有效、数据库并发安全或性能达标。实际业务测试按docs/acceptance-baseline执行，结果不能由这些静态脚本推断。
