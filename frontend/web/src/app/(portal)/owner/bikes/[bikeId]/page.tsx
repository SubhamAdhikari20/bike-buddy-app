import { BikeManagementDetails } from "@/components/bike-management-details";

export default async function OwnerBikeDetailsPage({
  params,
}: {
  params: Promise<{ bikeId: string }>;
}) {
  const { bikeId } = await params;
  return <BikeManagementDetails bikeId={bikeId} role="owner" />;
}
