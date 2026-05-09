import { useListBlackMarket, useGetMyListings, useBuyListing, useCreateListing, useCancelListing, getListBlackMarketQueryKey, getGetMyListingsQueryKey, getGetMyProfileQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Tag, Package, DollarSign, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

export default function BlackMarket() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<"weapon" | "ammo" | "armor">("weapon");
  const [newItemId, setNewItemId] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newPrice, setNewPrice] = useState("");

  const { data: listings, isLoading: isListingsLoading } = useListBlackMarket({ type: filterType === "all" ? undefined : filterType as any }, { query: { queryKey: getListBlackMarketQueryKey({ type: filterType === "all" ? undefined : filterType as any }) } });
  const { data: myListings, isLoading: isMyListingsLoading } = useGetMyListings({ query: { queryKey: getGetMyListingsQueryKey() } });

  const buyListing = useBuyListing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBlackMarketQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        toast({ title: "Purchase Successful", description: "Item acquired from the Black Market." });
      },
      onError: (err: any) => toast({ title: "Purchase Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  const cancelListing = useCancelListing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBlackMarketQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyListingsQueryKey() });
        toast({ title: "Listing Cancelled", description: "Your listing has been removed." });
      },
      onError: (err: any) => toast({ title: "Cancel Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  const createListing = useCreateListing({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBlackMarketQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyListingsQueryKey() });
        setIsCreateOpen(false);
        setNewItemId("");
        setNewQuantity("1");
        setNewPrice("");
        toast({ title: "Listing Created", description: "Your item is now on the Black Market." });
      },
      onError: (err: any) => toast({ title: "Create Failed", description: err?.response?.data?.error || "Error", variant: "destructive" })
    }
  });

  const handleCreate = () => {
    if (!newItemId || !newQuantity || !newPrice) return;
    createListing.mutate({ 
      data: { 
        itemType: newItemType, 
        itemId: parseInt(newItemId), 
        quantity: parseInt(newQuantity), 
        price: parseInt(newPrice) 
      } 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading font-bold uppercase tracking-wider">{t("nav.blackmarket")}</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="font-heading uppercase tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Create Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading uppercase tracking-wider text-xl text-primary">Sell Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Item Type</Label>
                <Select value={newItemType} onValueChange={(val: any) => setNewItemType(val)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weapon">Weapon</SelectItem>
                    <SelectItem value="ammo">Ammo</SelectItem>
                    <SelectItem value="armor">Armor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Item ID (Internal ID for now)</Label>
                <Input type="number" value={newItemId} onChange={(e) => setNewItemId(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Price (Total)</Label>
                <Input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="bg-background" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newItemId || !newQuantity || !newPrice || createListing.isPending}>List Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2 bg-card border border-border">
          <TabsTrigger value="browse" className="font-heading uppercase">Browse Market</TabsTrigger>
          <TabsTrigger value="mylistings" className="font-heading uppercase">My Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6 mt-6">
          <div className="flex items-center gap-4 bg-card p-4 border border-border rounded-lg">
            <Label className="font-heading uppercase tracking-wider">Filter:</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="All Items" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="weapon">Weapons</SelectItem>
                <SelectItem value="ammo">Ammunition</SelectItem>
                <SelectItem value="armor">Armor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isListingsLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 w-full bg-card" />)
            ) : listings && listings.length > 0 ? (
              listings.map((item) => (
                <Card key={item.id} className="bg-card border-border flex flex-col hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="font-heading uppercase tracking-wider">{item.itemName}</CardTitle>
                        <CardDescription className="text-xs mt-1">Seller: {item.sellerUsername}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="uppercase">{item.itemType}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-2">
                    <div className="flex justify-between items-center bg-secondary/30 p-3 rounded mt-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="font-bold">x{item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-500">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-mono font-bold text-lg">{item.price.toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-right">
                      Listed {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full font-heading uppercase"
                      onClick={() => buyListing.mutate({ listingId: item.id })}
                      disabled={buyListing.isPending}
                    >
                      Purchase
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-full p-12 text-center border border-border border-dashed rounded-xl bg-card/50">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-heading uppercase text-muted-foreground">The market is dry.</p>
                <p className="text-sm text-muted-foreground mt-2">No items match your filter criteria.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="mylistings" className="space-y-6 mt-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-heading uppercase flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Active Listings</CardTitle>
              <CardDescription>Items you are currently selling</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isMyListingsLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-16 w-full bg-secondary" />
                </div>
              ) : myListings && myListings.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {myListings.map((item) => (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold font-heading uppercase">{item.itemName}</p>
                          <Badge variant="outline" className="text-[10px] h-5">{item.itemType}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Listed {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Quantity / Price</p>
                          <p className="font-mono text-sm">
                            <span className="font-bold">x{item.quantity}</span> for <span className="text-green-500 font-bold">${item.price.toLocaleString()}</span>
                          </p>
                        </div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => cancelListing.mutate({ listingId: item.id })}
                          disabled={cancelListing.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">You don't have any items listed on the market.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}