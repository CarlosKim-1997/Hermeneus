import "next-auth";

declare module "next-auth" {
  interface Session {
    creatorId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    creatorId?: string;
  }
}
