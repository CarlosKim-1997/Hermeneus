import pg from "pg";
const url=process.env.TEST_DATABASE_URL;
if(!url||process.env.HERMENEUS_MCP_DISPOSABLE!=="1")throw Error("Disposable MCP database required");
const u=new URL(url);
if(!/^mcp-db-[a-f0-9]{32}$/.test(u.hostname)||u.pathname!=="/hermeneus_mcp_local_test"||u.username!=="mcp_fixture")throw Error("Target database forbidden");
const client=new pg.Client({connectionString:url});await client.connect();
try{await client.query("CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated");}
finally{await client.end();}
