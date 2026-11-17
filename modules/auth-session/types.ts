// Independent subset of the source HRMS session contract.
export type AppSession = {
  scope: "tenant";
  userId: string;
  tenantId: string;
  membershipId: string;
  role: "tenant_admin";
  email: string;
  displayName: string;
};
