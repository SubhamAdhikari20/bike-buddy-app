import { BikeManagementDetails } from "@/components/bike-management-details";

export default async function AdminBikeDetailsPage({
  params,
}: {
  params: Promise<{ bikeId: string }>;
}) {
  const { bikeId } = await params;
  return <BikeManagementDetails bikeId={bikeId} role="admin" />;
}
