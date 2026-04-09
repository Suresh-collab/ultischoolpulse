export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Child Details</h1>
      <p className="text-text-secondary">
        Child ID: {childId} — Coming soon
      </p>
    </div>
  );
}
