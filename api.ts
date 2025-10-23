// OpenAPI Code Generator for DDC Market SDK
// Generates TypeScript API client code from OpenAPI specification

// Organize generated code according to directory structure:
// - APIs in the same directory are placed in the same file
// - File name is the directory name
// - Each API is a TypeScript function
// - Automatically generate complete type definitions

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  // OpenAPI doc URL
  openApiUrl:
    'http://127.0.0.1:4523/export/openapi?projectId=7289678&specialPurpose=openapi-generator',

  // Output directory - generated to service/api directory
  outputDir: path.join(__dirname, 'src/service/api'),
};

interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, Record<string, PathItemObject>>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}

interface PathItemObject {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
}

interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: SchemaObject;
  description?: string;
}

interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  $ref?: string;
  description?: string;
  enum?: any[];
  format?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  additionalProperties?: boolean | SchemaObject;
}

interface EndpointGroup {
  directory: string;
  fileName: string;
  endpoints: Array<{
    path: string;
    method: string;
    operation: PathItemObject;
  }>;
}

/**
 * Fetch OpenAPI specification from URL
 */
async function fetchOpenAPISpec(url: string): Promise<OpenAPISchema> {
  console.log(`📥 Fetching OpenAPI spec from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
  }

  const spec = (await response.json()) as OpenAPISchema;
  console.log(
    `✅ Successfully fetched OpenAPI ${spec.openapi} spec: ${spec.info.title} v${spec.info.version}`
  );

  return spec;
}

/**
 * Convert OpenAPI type to TypeScript type
 */
function openApiTypeToTS(
  schema: SchemaObject | undefined,
  components?: Record<string, SchemaObject>,
  inline = false
): string {
  if (!schema) return 'unknown';

  // Handle $ref references
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    if (!inline && refName) {
      return `Types.${refName}`;
    }
    return refName || 'unknown';
  }

  // Handle allOf/oneOf/anyOf
  if (schema.allOf) {
    return schema.allOf.map((s) => openApiTypeToTS(s, components, inline)).join(' & ');
  }
  if (schema.oneOf || schema.anyOf) {
    const schemas = schema.oneOf || schema.anyOf || [];
    return schemas.map((s) => openApiTypeToTS(s, components, inline)).join(' | ');
  }

  // Handle enum
  if (schema.enum) {
    return schema.enum.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(' | ');
  }

  // Handle basic types
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `Array<${openApiTypeToTS(schema.items, components, inline)}>`;
    case 'object':
      if (schema.properties) {
        const props = Object.entries(schema.properties).map(([key, value]) => {
          const required = schema.required?.includes(key) ? '' : '?';
          const type = openApiTypeToTS(value, components, inline);
          const description = value.description ? `\n  /** ${value.description} */\n  ` : '';
          return `${description}${key}${required}: ${type}`;
        });
        return `{\n  ${props.join(';\n  ')};\n}`;
      }
      if (schema.additionalProperties) {
        if (typeof schema.additionalProperties === 'object') {
          return `Record<string, ${openApiTypeToTS(
            schema.additionalProperties,
            components,
            inline
          )}>`;
        }
        return 'Record<string, any>';
      }
      return 'Record<string, any>';
    default:
      return 'unknown';
  }
}

/**
 * Generate TypeScript interface from schema
 */
function generateInterface(
  name: string,
  schema: SchemaObject,
  components?: Record<string, SchemaObject>
): string {
  const description = schema.description ? `/**\n * ${schema.description}\n */\n` : '';
  const type = openApiTypeToTS(schema, components, true);

  if (type.startsWith('{')) {
    return `${description}export interface ${name} ${type}`;
  }
  return `${description}export type ${name} = ${type};`;
}

/**
 * Generate all type definitions
 */
function generateTypes(spec: OpenAPISchema): string {
  const lines: string[] = [
    '// Auto-generated TypeScript types from OpenAPI specification',
    '// Do not edit this file manually',
    '',
  ];

  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      lines.push(generateInterface(name, schema, spec.components.schemas));
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Extract directory name from path
 * Example: /api/users/{id} => api
 *          /api/v1/products => api-v1
 *          /config => api (root level)
 *          /users/profile => users
 */
function extractDirectoryName(apiPath: string): string {
  // Remove leading/trailing slashes and parameters
  const parts = apiPath.split('/').filter((p) => p && !p.startsWith('{'));

  // If there are multiple parts, use the first meaningful directory
  // Example: /api/users => 'api', /users/profile => 'users'
  if (parts.length > 1) {
    return parts[0];
  }

  // If only one part or root level endpoints, group them in 'api'
  return 'api';
}

/**
 * Group endpoints by directory
 */
function groupEndpointsByDirectory(spec: OpenAPISchema): Map<string, EndpointGroup> {
  const groups = new Map<string, EndpointGroup>();

  for (const [path, methods] of Object.entries(spec.paths)) {
    const directory = extractDirectoryName(path);

    if (!groups.has(directory)) {
      groups.set(directory, {
        directory,
        fileName: directory,
        endpoints: [],
      });
    }

    for (const [method, operation] of Object.entries(methods)) {
      groups.get(directory)!.endpoints.push({
        path,
        method,
        operation,
      });
    }
  }

  return groups;
}

/**
 * Generate function name from operation
 * Priority: operationId > summary > generated from path
 */
function generateFunctionName(path: string, method: string, operation: PathItemObject): string {
  // Priority 1: Use operationId if available
  if (operation.operationId) {
    return operation.operationId;
  }

  // Priority 2: Use summary if available (convert PascalCase to camelCase)
  if (operation.summary) {
    // Remove special characters and whitespace, then convert to camelCase
    let name = operation.summary
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special chars and spaces
      .trim();

    if (name) {
      // Convert PascalCase to camelCase (lowercase first letter)
      name = name.charAt(0).toLowerCase() + name.slice(1);
      return name;
    }
  }

  // Priority 3: Generate from path and method
  const pathParts = path
    .split('/')
    .filter((p) => p && !p.startsWith('{'))
    .filter((p) => p !== 'api' && !p.match(/^v\d+$/))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1));

  const methodPrefix = method.toLowerCase();
  return methodPrefix + pathParts.join('');
}

/**
 * Extract parameters from operation
 */
function extractParameters(operation: PathItemObject): {
  pathParams: ParameterObject[];
  queryParams: ParameterObject[];
  hasBody: boolean;
  requestBodyType: string;
} {
  const pathParams: ParameterObject[] = [];
  const queryParams: ParameterObject[] = [];

  if (operation.parameters) {
    for (const param of operation.parameters) {
      if (param.in === 'path') {
        pathParams.push(param);
      } else if (param.in === 'query') {
        queryParams.push(param);
      }
    }
  }

  let hasBody = false;
  let requestBodyType = 'unknown';

  if (operation.requestBody) {
    hasBody = true;
    const content = operation.requestBody.content?.['application/json'];
    if (content?.schema) {
      requestBodyType = openApiTypeToTS(content.schema);
    }
  }

  return { pathParams, queryParams, hasBody, requestBodyType };
}

/**
 * Extract response type from operation
 */
function extractResponseType(operation: PathItemObject): string {
  const successResponse = operation.responses?.['200'] || operation.responses?.['201'];

  if (successResponse?.content?.['application/json']?.schema) {
    return openApiTypeToTS(successResponse.content['application/json'].schema);
  }

  return 'unknown';
}

/**
 * Generate API function code
 */
function generateApiFunction(path: string, method: string, operation: PathItemObject): string {
  const functionName = generateFunctionName(path, method, operation);
  const { pathParams, queryParams, hasBody, requestBodyType } = extractParameters(operation);
  const responseType = extractResponseType(operation);

  const lines: string[] = [];

  // Add JSDoc
  lines.push('/**');
  if (operation.summary) lines.push(` * ${operation.summary}`);
  if (operation.description) lines.push(` * ${operation.description}`);
  lines.push(` * @path ${method.toUpperCase()} ${path}`);
  lines.push(' */');

  // Build function parameters
  const params: string[] = [];

  // Add path parameters
  for (const param of pathParams) {
    const type = openApiTypeToTS(param.schema);
    const description = param.description ? `/** ${param.description} */ ` : '';
    params.push(`${description}${param.name}: ${type}`);
  }

  // Add request body parameter
  if (hasBody) {
    params.push(`data: ${requestBodyType}`);
  }

  // Add query/config parameter
  if (queryParams.length > 0) {
    const queryType = `{\n  ${queryParams
      .map((p) => {
        const type = openApiTypeToTS(p.schema);
        const required = p.required ? '' : '?';
        const description = p.description ? `/** ${p.description} */ ` : '';
        return `${description}${p.name}${required}: ${type}`;
      })
      .join(';\n  ')};\n}`;
    params.push(`params?: ${queryType}`);
  } else {
    params.push(`config?: ApiRequestConfig`);
  }

  // Generate function signature
  lines.push(`export async function ${functionName}(`);
  if (params.length > 0) {
    lines.push(`  ${params.join(',\n  ')}`);
  }
  lines.push(`): Promise<ApiResponse<${responseType}>> {`);

  // Generate path with parameters
  let urlPath = path;
  for (const param of pathParams) {
    urlPath = urlPath.replace(`{${param.name}}`, `\${${param.name}}`);
  }

  // Generate function body
  const methodLower = method.toLowerCase();
  if (methodLower === 'get') {
    if (queryParams.length > 0) {
      lines.push(`  return requestGet<${responseType}>(\`${urlPath}\`, { params });`);
    } else {
      lines.push(`  return requestGet<${responseType}>(\`${urlPath}\`, config);`);
    }
  } else if (methodLower === 'post') {
    if (hasBody) {
      if (queryParams.length > 0) {
        lines.push(`  return requestPost<${responseType}>(\`${urlPath}\`, data, { params });`);
      } else {
        lines.push(`  return requestPost<${responseType}>(\`${urlPath}\`, data, config);`);
      }
    } else {
      lines.push(`  return requestPost<${responseType}>(\`${urlPath}\`, {}, config);`);
    }
  } else if (methodLower === 'put') {
    if (hasBody) {
      lines.push(
        `  return requestPost<${responseType}>(\`${urlPath}\`, data, config); // TODO: Use requestPut when available`
      );
    } else {
      lines.push(
        `  return requestPost<${responseType}>(\`${urlPath}\`, {}, config); // TODO: Use requestPut when available`
      );
    }
  } else if (methodLower === 'delete') {
    lines.push(
      `  return requestPost<${responseType}>(\`${urlPath}\`, {}, config); // TODO: Use requestDelete when available`
    );
  } else {
    lines.push(`  return requestPost<${responseType}>(\`${urlPath}\`, data || {}, config);`);
  }

  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate API file for a directory group
 */
function generateApiFile(group: EndpointGroup, hasTypes: boolean): string {
  const lines: string[] = [
    `// Auto-generated API functions for ${group.directory}`,
    '// Do not edit this file manually',
    '',
    "import { requestGet, requestPost } from '../index';",
    "import type { ApiResponse, ApiRequestConfig } from '../../types';",
  ];

  // Only import types if they exist
  if (hasTypes) {
    lines.push("import type * as Types from './types';");
  }

  lines.push('');

  for (const { path, method, operation } of group.endpoints) {
    lines.push(generateApiFunction(path, method, operation));
  }

  return lines.join('\n');
}

/**
 * Generate index file that exports all API modules
 */
function generateIndexFile(groups: Map<string, EndpointGroup>): string {
  const lines: string[] = ['// Auto-generated index file', '// Do not edit this file manually', ''];

  for (const group of groups.values()) {
    lines.push(`export * from './${group.fileName}';`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Ensure directory exists
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Remove directory recursively
 */
function removeDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Main generation function
 */
async function generate() {
  try {
    console.log('🚀 Starting OpenAPI code generation...\n');

    // Step 1: Clean up - Remove existing api folder
    console.log('🧹 Cleaning up existing api folder...');
    removeDir(CONFIG.outputDir);
    console.log('✅ Old api folder removed\n');

    // Step 2: Fetch OpenAPI spec
    const spec = await fetchOpenAPISpec(CONFIG.openApiUrl);

    // Step 3: Ensure output directory exists
    ensureDir(CONFIG.outputDir);

    // Step 4: Generate types
    console.log('\n📝 Generating TypeScript types...');
    const typesCode = generateTypes(spec);
    const typesPath = path.join(CONFIG.outputDir, 'types.ts');
    fs.writeFileSync(typesPath, typesCode);
    console.log(`✅ Types generated: ${path.relative(process.cwd(), typesPath)}`);

    // Step 5: Group endpoints by directory
    console.log('\n📁 Grouping endpoints by directory...');
    const groups = groupEndpointsByDirectory(spec);
    console.log(`✅ Found ${groups.size} directory groups:`);
    for (const [dir, group] of groups.entries()) {
      console.log(`   - ${dir}: ${group.endpoints.length} endpoints`);
    }

    // Step 6: Generate API files for each group
    console.log('\n📝 Generating API files...');
    const generatedFiles: string[] = [];
    const hasTypes = spec.components?.schemas && Object.keys(spec.components.schemas).length > 0;

    for (const group of groups.values()) {
      const apiCode = generateApiFile(group, hasTypes || false);
      const apiPath = path.join(CONFIG.outputDir, `${group.fileName}.ts`);
      fs.writeFileSync(apiPath, apiCode);
      generatedFiles.push(path.relative(process.cwd(), apiPath));
      console.log(`✅ Generated: ${path.relative(process.cwd(), apiPath)}`);
    }

    // Step 7: Generate index file
    console.log('\n📝 Generating index file...');
    const indexCode = generateIndexFile(groups);
    const indexPath = path.join(CONFIG.outputDir, 'index.ts');
    fs.writeFileSync(indexPath, indexCode);
    console.log(`✅ Index generated: ${path.relative(process.cwd(), indexPath)}`);

    // Summary
    console.log('\n✨ Code generation completed successfully!\n');
    console.log('📦 Generated files:');
    console.log(`   - ${path.relative(process.cwd(), typesPath)}`);
    generatedFiles.forEach((file) => console.log(`   - ${file}`));
    console.log(`   - ${path.relative(process.cwd(), indexPath)}`);
    console.log('\n💡 You can now import and use the generated API functions:');
    console.log("   import { functionName } from './service/api';");
    console.log('');
  } catch (error) {
    console.error('\n❌ Code generation failed:', error);
    process.exit(1);
  }
}

// Run generator
generate();
