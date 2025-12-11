import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, ArrowLeft, Scale, FolderOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Draft {
  id: string;
  draft_name: string;
  template_id: string;
  created_at: string;
  updated_at: string;
  placeholders: Record<string, string>;
  documents: any[];
  deeds: any;
}

const Drafts = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem("userLoggedIn");
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    
    loadDrafts();
  }, [navigate]);

  const loadDrafts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("drafts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDrafts((data as any) || []);
    } catch (error) {
      console.error("Error loading drafts:", error);
      toast.error("Failed to load drafts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDraft = (draft: Draft) => {
    // Persist identifiers in the URL so reloads can restore from DB
    navigate(`/work?draftId=${draft.id}&templateId=${draft.template_id}`, {
      state: {
        templateId: draft.template_id,
        draftId: draft.id,
        draftName: draft.draft_name,
        draftData: {
          placeholders: draft.placeholders,
          documents: draft.documents,
          deeds: draft.deeds,
        },
      },
    });
  };

  const handleDeleteDraft = async (draftId: string, draftName: string) => {
    if (!confirm(`Are you sure you want to request deletion of "${draftName}"?`)) {
      return;
    }

    try {
      // Get current user info
      const username = localStorage.getItem("username") || "Unknown User";

      // Create an approval request for draft deletion
      const { error } = await supabase
        .from("approval_requests")
        .insert({
          request_type: "delete_draft",
          draft_id: draftId,
          template_name: draftName,
          file_name: draftName,
          requested_by: username,
          status: "pending"
        });

      if (error) throw error;

      toast.success("Deletion request sent to admin for approval");
    } catch (error) {
      console.error("Error creating approval request:", error);
      toast.error("Failed to send approval request");
    }
  };

  // Filter drafts based on search query
  const filteredDrafts = drafts.filter((draft) =>
    draft.draft_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Blue Header */}
      <header className="bg-blue-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Scale className="h-10 w-10" />
              <div>
                <h1 className="text-2xl font-bold">Babu Advocate</h1>
                <p className="text-blue-100 text-sm">Professional Document Generation System</p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => navigate("/templates")}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Templates
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Your Drafts</h2>
          <p className="text-muted-foreground mt-1">View and manage your saved drafts</p>
        </div>

        {/* Drafts Content */}
        <Card className="border-border">
          <CardContent className="p-12">
            {/* Search Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      <span className="text-lg font-bold">{filteredDrafts.length}</span> {filteredDrafts.length === 1 ? 'draft' : 'drafts'} {searchQuery && 'found'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground transition-all duration-300 group-focus-within:text-primary group-focus-within:scale-110" />
                <Input
                  type="text"
                  placeholder="Search drafts by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base border-2 border-border/50 focus:border-primary/50 transition-all duration-300 rounded-xl bg-background/50"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="animate-pulse">Loading drafts...</div>
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {searchQuery ? 'No drafts found' : 'No drafts yet'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery ? 'Try adjusting your search query' : 'Start working on a template and save it as a draft'}
                </p>
                {!searchQuery && (
                  <Button 
                    onClick={() => navigate("/templates")}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go to Templates
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredDrafts.map((draft) => (
                  <Card key={draft.id} className="border-border hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground truncate">{draft.draft_name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {Object.keys(draft.placeholders || {}).length} fields
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {format(new Date(draft.created_at), "MMM d, yyyy")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleOpenDraft(draft)}
                        >
                          <FolderOpen className="mr-1 h-3 w-3" />
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDeleteDraft(draft.id, draft.draft_name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Drafts;
