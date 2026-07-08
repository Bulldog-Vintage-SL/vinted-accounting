import { ListingDetailForm } from './ListingDetailForm'

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="w-full py-0 px-4 lg:px-8">
      <ListingDetailForm listingId={id} />
    </div>
  )
}
