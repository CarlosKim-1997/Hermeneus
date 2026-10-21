import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createScopedMcpHandler } from "../../src/mcp/server.js";
import { fixture,fixtureIssuer,fixtureResource } from "./helpers.js";
export async function connected(f=fixture()) {
  const handler=createScopedMcpHandler({service:f.service,issuer:fixtureIssuer,resource:fixtureResource,enabled:true});
  const client=new Client({name:"local-mcp-test",version:"1.0.0"});
  const transport=new StreamableHTTPClientTransport(new URL(fixtureResource),{requestInit:{headers:{authorization:"Bearer "+f.token}},fetch:async(input,init)=>handler(new Request(input,init))});
  await client.connect(transport);return {f,handler,client};
}
