"""Independent OpenAPI + JSON Schema validation; install requirements-contract.txt."""
import json
from pathlib import Path
from openapi_spec_validator import validate
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
spec = json.loads((ROOT / 'contracts/openapi.yaml').read_text())
validate(spec)
count = 0

def resolve(value):
    if '$ref' not in value:
        return value
    node = spec
    assert value['$ref'].startswith('#/'), 'Only local references in this baseline'
    for part in value['$ref'][2:].split('/'):
        node = node[part.replace('~1', '/').replace('~0', '~')]
    return node

def check(schema, value, location):
    global count
    # Components preserve the root resolution scope of all local OpenAPI refs.
    root = dict(schema, components=spec['components'])
    errors = list(Draft202012Validator(root, format_checker=FormatChecker()).iter_errors(value))
    if errors:
        raise AssertionError(f'{location}: {errors[0].message}')
    count += 1

operations = 0
for path, methods in spec['paths'].items():
    for method, op in methods.items():
        if method not in {'get', 'post', 'put', 'patch', 'delete'}:
            continue
        operations += 1
        for status, response in op['responses'].items():
            for media in resolve(response).get('content', {}).values():
                if 'example' in media:
                    check(media['schema'], media['example'], f'{method} {path} response {status}')
                for name, example in media.get('examples', {}).items():
                    if 'value' in example:
                        check(media['schema'], example['value'], f'{method} {path} {status} {name}')
        request = resolve(op.get('requestBody', {}))
        for media in request.get('content', {}).values():
            if 'example' in media:
                check(media['schema'], media['example'], f'{method} {path} request')
            for name, example in media.get('examples', {}).items():
                if 'value' in example:
                    check(media['schema'], example['value'], f'{method} {path} request {name}')
print(json.dumps({'result': 'PASS', 'version': spec['info']['version'], 'operations': operations,
                  'validatedExamples': count, 'checks': ['OpenAPI 3.1 specification',
                  'JSON Schema 2020-12 request and response examples with format checks'],
                  'notVerified': ['backend implementation', 'runtime authorization',
                  'money and inventory concurrency', 'performance']}, ensure_ascii=False, indent=2))
