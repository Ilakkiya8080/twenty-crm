const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schemaRes = await client.query(`SELECT "databaseSchema" FROM core.workspace WHERE id = $1`, [wsId]);
  const schema = schemaRes.rows[0].databaseSchema;

  console.log(`Setting up agent sync trigger on ${schema}."workspaceMember"...`);

  await client.query(`
    CREATE OR REPLACE FUNCTION ${schema}.sync_agent_user_workspace()
    RETURNS TRIGGER AS $$
    DECLARE
      v_user_id uuid;
      v_email text;
      v_first_name text;
      v_last_name text;
      v_existing_user_id uuid;
      v_ws_id uuid := '32c2a902-9983-4e13-b6f6-bc96609f8238';
    BEGIN
      v_first_name := COALESCE(NEW."nameFirstName", 'Agent');
      v_last_name := COALESCE(NEW."nameLastName", '');

      IF NEW."userEmail" IS NOT NULL AND NEW."userEmail" <> '' THEN
        v_email := LOWER(TRIM(NEW."userEmail"));
        SELECT id INTO v_existing_user_id FROM core."user" WHERE LOWER(email::text) = v_email AND "deletedAt" IS NULL LIMIT 1;
        IF v_existing_user_id IS NOT NULL THEN
          v_user_id := v_existing_user_id;
        END IF;
      END IF;

      IF v_user_id IS NULL THEN
        IF NEW."userId" IS NOT NULL THEN
          v_user_id := NEW."userId";
        ELSE
          v_user_id := gen_random_uuid();
        END IF;
        IF v_email IS NULL OR v_email = '' THEN
          v_email := 'agent.' || v_user_id || '@twentyestates.com';
        END IF;

        INSERT INTO core."user" (id, email, "firstName", "lastName", "createdAt", "updatedAt", "isEmailVerified")
        VALUES (v_user_id, v_email, v_first_name, v_last_name, NOW(), NOW(), true)
        ON CONFLICT (id) DO UPDATE 
          SET "firstName" = EXCLUDED."firstName",
              "lastName" = EXCLUDED."lastName";
      END IF;

      NEW."userId" := v_user_id;

      -- Ensure userWorkspace exists in core."userWorkspace"
      IF NOT EXISTS (
        SELECT 1 FROM core."userWorkspace" 
        WHERE "userId" = v_user_id AND "workspaceId" = v_ws_id AND "deletedAt" IS NULL
      ) THEN
        INSERT INTO core."userWorkspace" (id, "userId", "workspaceId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), v_user_id, v_ws_id, NOW(), NOW());
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_agent_user ON ${schema}."workspaceMember";

    CREATE TRIGGER trg_sync_agent_user
    BEFORE INSERT ON ${schema}."workspaceMember"
    FOR EACH ROW
    EXECUTE FUNCTION ${schema}.sync_agent_user_workspace();
  `);

  console.log('Database trigger created successfully!');
  await client.end();
}

async function patchDistFiles() {
  const hooksDir = '/app/packages/twenty-server/dist/modules/workspace-member/query-hooks';
  if (!fs.existsSync(hooksDir)) {
    console.log(`Hooks dir ${hooksDir} not found, skipping container patch.`);
    return;
  }

  const hooks = [
    {
      file: 'workspace-member-create-one.pre-query.hook.js',
      className: 'WorkspaceMemberCreateOnePreQueryHook',
      decorator: 'workspaceMember.createOne',
    },
    {
      file: 'workspace-member-create-many.pre-query.hook.js',
      className: 'WorkspaceMemberCreateManyPreQueryHook',
      decorator: 'workspaceMember.createMany',
    },
    {
      file: 'workspace-member-delete-one.pre-query.hook.js',
      className: 'WorkspaceMemberDeleteOnePreQueryHook',
      decorator: 'workspaceMember.deleteOne',
    },
    {
      file: 'workspace-member-delete-many.pre-query.hook.js',
      className: 'WorkspaceMemberDeleteManyPreQueryHook',
      decorator: 'workspaceMember.deleteMany',
    },
    {
      file: 'workspace-member-destroy-one.pre-query.hook.js',
      className: 'WorkspaceMemberDestroyOnePreQueryHook',
      decorator: 'workspaceMember.destroyOne',
    },
    {
      file: 'workspace-member-destroy-many.pre-query.hook.js',
      className: 'WorkspaceMemberDestroyManyPreQueryHook',
      decorator: 'workspaceMember.destroyMany',
    },
  ];

  for (const hook of hooks) {
    const fullPath = path.join(hooksDir, hook.file);
    const content = `"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "${hook.className}", {
    enumerable: true,
    get: function() {
        return ${hook.className};
    }
});
const _utils = require("twenty-shared/utils");
const _workspacequeryhookdecorator = require("../../../engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator");
const _workspaceexception = require("../../../engine/core-modules/workspace/workspace.exception");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let ${hook.className} = class ${hook.className} {
    async execute(authContext, objectName, payload) {
        const workspace = authContext.workspace;
        (0, _utils.assertIsDefinedOrThrow)(workspace, _workspaceexception.WorkspaceNotFoundDefaultError);
        return payload;
    }
    constructor(){}
};
${hook.className} = _ts_decorate([
    (0, _workspacequeryhookdecorator.WorkspaceQueryHook)(\`${hook.decorator}\`),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [])
], ${hook.className});
`;
    fs.writeFileSync(fullPath, content);
    console.log(`Patched ${hook.file}`);
  }
}

async function main() {
  await setupDatabase();
  await patchDistFiles();
  console.log('All patches applied successfully!');
}

main().catch(console.error);

