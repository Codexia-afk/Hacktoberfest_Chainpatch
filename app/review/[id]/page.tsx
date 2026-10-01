import { ReviewWorkbench } from "@/components/review-workbench";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewWorkbench id={id} />;
}
