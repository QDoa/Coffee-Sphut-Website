import Image from "next/image";
import type { ReviewField } from "@/lib/partner/reviews";

export function RequestFieldList({ fields, compare }: { fields: ReviewField[]; compare: boolean }) {
  return (
    <dl className="divide-y rounded-xl border">
      {fields.map((field) => (
        <div key={field.key} className="grid min-w-0 gap-2 p-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <dt className="font-medium [overflow-wrap:anywhere]">{field.label}</dt>
          <dd className={`grid min-w-0 gap-2 ${compare ? "sm:grid-cols-2" : ""}`}>
            {compare && (
              <div className="min-w-0 rounded-lg bg-muted/45 p-2.5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Current</p>
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{field.current ?? "Unavailable in this review"}</p>
              </div>
            )}
            <div className={compare ? "min-w-0 rounded-lg bg-primary/5 p-2.5" : "min-w-0"}>
              {compare && <p className="mb-1 text-xs font-medium text-primary">Proposed</p>}
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{field.proposed}</p>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function RequestPhotoGrid({ photos, staff = false }: {
  photos: { id: string; label: string }[];
  staff?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map(({ id, label }) => {
        const src = `/partner/media/${id}${staff ? "?review=1" : ""}`;
        return (
          <figure key={`${id}-${label}`} className="min-w-0">
            <a href={src} target="_blank" rel="noreferrer">
              <Image
                src={src}
                alt={label}
                width={240}
                height={180}
                unoptimized
                className="aspect-4/3 w-full rounded-lg bg-muted object-cover"
              />
            </a>
            <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
