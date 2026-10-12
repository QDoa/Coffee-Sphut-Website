import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/auth";
import { saveCafeAction, saveMenuItemAction, deleteMenuItemAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HistoryPanel } from "@/components/admin/history-panel";
import { DeleteButton } from "@/components/admin/delete-button";
import { RichTextEditor } from "@/components/admin/rich-text-editor";

interface CafeEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function CafeEditPage({ params }: CafeEditPageProps) {
  const staff = await requireStaff("editor");
  const { id } = await params;
  const isNew = id === "new";

  const supabase = await createClient();

  const { data: chains } = await supabase
    .from("Chains")
    .select("id, name")
    .order("name", { ascending: true });

  let cafe = null;
  let galleryImages: string[] = [];
  let menuItems: Array<{ id: string; name: string; price: number; currency: string; description: string | null }> = [];

  if (!isNew) {
    const cafeId = Number(id);
    const { data } = await supabase
      .from("Cafe")
      .select("*")
      .eq("id", cafeId)
      .maybeSingle();

    if (!data) notFound();
    cafe = data;

    const { data: imgData } = await supabase
      .from("CafeImages")
      .select("images_url")
      .eq("cafe_id", cafeId)
      .maybeSingle();

    galleryImages = (imgData?.images_url as string[]) || [];

    const { data: mData } = await supabase
      .from("CafeMenu")
      .select("id, name, price, currency, description")
      .eq("cafe_id", cafeId)
      .order("name", { ascending: true });

    menuItems = mData || [];
  }

  const formAction = async (formData: FormData) => {
    "use server";
    const res = await saveCafeAction(isNew ? null : id, formData);
    if (res?.error) throw new Error(res.error);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/cafes">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Cafes
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isNew ? "Create New Cafe" : `Edit Cafe: ${cafe?.name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure store location, operating hours, amenities, and menu items.
          </p>
        </div>
      </div>

      <form action={formAction}>
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="location">Location & Hours</TabsTrigger>
            <TabsTrigger value="contact">Contact & Social</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="menu" disabled={isNew}>
              Menu {menuItems.length > 0 ? `(${menuItems.length})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DETAILS */}
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Core Store Details</CardTitle>
                <CardDescription>Name, brand affiliation, loyalty code, and ratings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Cafe Name *</Label>
                    <Input id="name" name="name" defaultValue={cafe?.name || ""} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chain_id">Chain / Brand *</Label>
                    <select
                      id="chain_id"
                      name="chain_id"
                      defaultValue={cafe?.chain_id || chains?.[0]?.id || ""}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    >
                      {chains?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Store Description</Label>
                  <RichTextEditor
                    id="description"
                    name="description"
                    defaultValue={cafe?.description || ""}
                    rows={5}
                    placeholder="Store description, specialty drinks, ambiance..."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="reward_code">Reward Code</Label>
                    <Input
                      id="reward_code"
                      name="reward_code"
                      defaultValue={cafe?.reward_code || ""}
                      placeholder="e.g. MONO12"
                    />
                    <p className="text-[11px] text-muted-foreground">Unique code entered by baristas.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loyalty_threshold_override">Loyalty Threshold Override</Label>
                    <Input
                      id="loyalty_threshold_override"
                      name="loyalty_threshold_override"
                      type="number"
                      defaultValue={cafe?.loyalty_threshold_override ?? ""}
                      placeholder="Leave blank to use chain default"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (0 - 5.0)</Label>
                    <Input
                      id="rating"
                      name="rating"
                      type="number"
                      step="0.1"
                      min={0}
                      max={5}
                      defaultValue={cafe?.rating ?? ""}
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      defaultChecked={cafe?.is_active ?? true}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="is_active">Store is Active in Discovery</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="show_details"
                      name="show_details"
                      defaultChecked={cafe?.show_details ?? false}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="show_details">Show Full Details in Mobile App</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: LOCATION & HOURS */}
          <TabsContent value="location">
            <Card>
              <CardHeader>
                <CardTitle>Location & Coordinates</CardTitle>
                <CardDescription>
                  Updating latitude or longitude automatically recomputes the PostGIS geographic point.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="address">Physical Street Address</Label>
                    <Input id="address" name="address" defaultValue={cafe?.address || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postal / Zip Code</Label>
                    <Input id="postcode" name="postcode" defaultValue={cafe?.postcode || ""} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      name="latitude"
                      type="number"
                      step="any"
                      defaultValue={cafe?.latitude ?? ""}
                      placeholder="e.g. 51.0447"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      name="longitude"
                      type="number"
                      step="any"
                      defaultValue={cafe?.longitude ?? ""}
                      placeholder="e.g. -114.0719"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label htmlFor="time_open_json">Operating Hours (JSON format)</Label>
                  <Textarea
                    id="time_open_json"
                    name="time_open_json"
                    defaultValue={cafe?.time_open ? JSON.stringify(cafe.time_open, null, 2) : ""}
                    rows={4}
                    placeholder='{"Monday": {"open": "8:00", "close": "18:00"}, "Tuesday": {"open": "8:00", "close": "18:00" }, ...}'
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CONTACT & AMENITIES */}
          <TabsContent value="contact">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information & Amenities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input id="phone_number" name="phone_number" defaultValue={cafe?.phone_number || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={cafe?.email || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="link">Website Link</Label>
                    <Input id="link" name="link" defaultValue={cafe?.link || ""} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                  <Input
                    id="amenities"
                    name="amenities"
                    defaultValue={((cafe?.amenities as string[]) || []).join(", ")}
                    placeholder="wifi, sitting_area, delivery_service, disabled_access, work_station"
                  />
                  <p className="text-xs text-muted-foreground">Used for amenity filtering in store search.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: IMAGES */}
          <TabsContent value="images">
            <Card>
              <CardHeader>
                <CardTitle>Store Imagery</CardTitle>
                <CardDescription>Primary cover image and secondary gallery URLs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image_url">Cover Image URL</Label>
                  <Input id="image_url" name="image_url" defaultValue={cafe?.image_url || ""} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gallery_images">Gallery Image URLs (one per line)</Label>
                  <Textarea
                    id="gallery_images"
                    name="gallery_images"
                    defaultValue={galleryImages.join("\n")}
                    rows={4}
                    placeholder="https://..."
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: MENU (Only for existing cafes) */}
          {!isNew && (
            <TabsContent value="menu">
              <Card>
                <CardHeader>
                  <CardTitle>Cafe Menu Items</CardTitle>
                  <CardDescription>Drink and food menu items displayed for this location.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Inline item adder */}
                  <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Add Menu Item
                    </h4>
                    <form
                      action={async (fd: FormData) => {
                        "use server";
                        await saveMenuItemAction(Number(id), fd);
                      }}
                      className="grid gap-3 sm:grid-cols-4 items-end"
                    >
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="menu_name" className="text-xs">Item Name</Label>
                        <Input id="menu_name" name="name" required placeholder="Cortado" className="h-8 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="menu_price" className="text-xs">Price (Cents)</Label>
                        <Input id="menu_price" name="price" type="number" required placeholder="475" className="h-8 text-xs" />
                      </div>
                      <div>
                        <Button type="submit" size="sm" className="w-full h-8 text-xs">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Menu items table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead className="w-[100px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {menuItems.length > 0 ? (
                        menuItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              ${(item.price / 100).toFixed(2)} {item.currency}
                            </TableCell>
                            <TableCell className="text-right">
                              {staff.role === "admin" && (
                                <DeleteButton
                                  action={async () => {
                                    "use server";
                                    await deleteMenuItemAction(item.id, Number(id));
                                  }}
                                  title={`Delete ${item.name}?`}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground">
                            No menu items added yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button asChild variant="outline">
              <Link href="/admin/cafes">Cancel</Link>
            </Button>
            <Button type="submit">Save Cafe</Button>
          </div>
        </Tabs>
      </form>

      {!isNew && <HistoryPanel tableName="Cafe" recordId={id} />}
    </div>
  );
}
