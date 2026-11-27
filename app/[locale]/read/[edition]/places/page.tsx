import { EntityIndexPage, indexMetadata, type IndexParams, type IndexSearch } from "@/components/EntityIndexPage";

export const generateMetadata = ({ params }: { params: Promise<IndexParams> }) => indexMetadata(params, "place");

export default function Page(props: { params: Promise<IndexParams>; searchParams?: Promise<IndexSearch> }) {
  return <EntityIndexPage {...props} type="place" />;
}
