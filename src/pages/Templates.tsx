import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, Trash2, Download, Plus, LogOut, Scale, LogIn, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Template {
  id: string;
  template_name: string;
  file_name: string;
  created_at: string;
  updated_at: string;
}

const Templates = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem("userLoggedIn");
    if (!isLoggedIn) {
      navigate("/");
      return;
    }
    
    loadTemplates();
  }, [navigate]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("document_templates")
        .select("id, template_name, file_name, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
      setUploadedFile(file);
    } else if (file) {
      toast.error("Please upload a .doc or .docx file");
    }
  };

  const handleUploadTemplate = async () => {
    if (!uploadedFile || !templateName.trim()) {
      toast.error("Please provide a template name and upload a file");
      return;
    }

    try {
      setIsUploading(true);
      
      // Convert file to ArrayBuffer and then to hex string for PostgreSQL bytea
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const hexString = '\\x' + bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const { error } = await supabase
        .from("document_templates")
        .insert({
          template_name: templateName.trim(),
          file_name: uploadedFile.name,
          file_data: hexString,
        });

      if (error) throw error;

      toast.success("Template uploaded successfully");
      setShowUploadDialog(false);
      setTemplateName("");
      setUploadedFile(null);
      loadTemplates();
    } catch (error) {
      console.error("Error uploading template:", error);
      toast.error("Failed to upload template");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = async (templateId: string, fileName: string, templateName: string) => {
    try {
      // Create approval request
      const { error } = await supabase
        .from("approval_requests" as any)
        .insert({
          request_type: "download",
          template_id: templateId,
          template_name: templateName,
          file_name: fileName,
          requested_by: localStorage.getItem("userLoggedIn") || "Unknown User",
          status: "pending"
        });

      if (error) throw error;

      toast.success("Download request sent for admin approval");
    } catch (error) {
      console.error("Error creating download request:", error);
      toast.error("Failed to create download request");
    }
  };

  const handleDeleteTemplate = async (templateId: string, templateName: string, fileName: string) => {
    try {
      // Create approval request
      const { error } = await supabase
        .from("approval_requests" as any)
        .insert({
          request_type: "delete",
          template_id: templateId,
          template_name: templateName,
          file_name: fileName,
          requested_by: localStorage.getItem("userLoggedIn") || "Unknown User",
          status: "pending"
        });

      if (error) throw error;

      toast.success("Delete request sent for admin approval");
    } catch (error) {
      console.error("Error creating delete request:", error);
      toast.error("Failed to create delete request");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("userLoggedIn");
    try { await supabase.auth.signOut(); } catch {}
    navigate("/");
  };

  const handleAdminPortal = () => {
    navigate("/auth");
  };

  // Filter templates based on search query
  const filteredTemplates = templates.filter((template) => 
    template.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/[0.02] to-accent/[0.03] relative">
      {/* Animated background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Enhanced Header with Glass Morphism */}
      <header className="gradient-hero text-white shadow-xl relative overflow-hidden border-b border-white/10">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 20px 20px, white 2px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 shimmer opacity-30"></div>
        
        <div className="container mx-auto px-6 py-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 animate-fade-in">
              <div className="p-3 bg-white/15 rounded-xl backdrop-blur-md shadow-lg animate-bounce-gentle border border-white/20">
                <Scale className="h-12 w-12 drop-shadow-2xl" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight drop-shadow-lg">Babu Advocate</h1>
                <p className="text-white/95 text-sm mt-1.5 font-medium">Professional Document Generation System</p>
              </div>
            </div>
            <div className="flex gap-3 animate-fade-in">
              <Button 
                variant="outline"
                onClick={() => navigate("/drafts")}
                className="bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white hover:scale-105 hover:shadow-xl transition-all duration-300 backdrop-blur-md font-medium"
              >
                <FileText className="mr-2 h-4 w-4" />
                Drafts
              </Button>
              <Button 
                variant="outline"
                onClick={handleAdminPortal}
                className="bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white hover:scale-105 hover:shadow-xl transition-all duration-300 backdrop-blur-md font-medium"
              >
                <Scale className="mr-2 h-4 w-4" />
                Admin Portal
              </Button>
              <Button 
                variant="outline"
                onClick={handleLogout}
                className="bg-white/15 text-white border-white/30 hover:bg-white/25 hover:text-white hover:scale-105 hover:shadow-xl transition-all duration-300 backdrop-blur-md font-medium"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-10 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent drop-shadow-sm">
                Document Templates
              </h2>
              <p className="text-muted-foreground text-base">Select a template or create a new one to get started</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => setShowUploadDialog(true)}
                className="hover-lift hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-300 border-2 font-medium"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload Word
              </Button>
              <Button 
                onClick={() => setShowNewTemplateDialog(true)}
                className="gradient-primary text-white hover:shadow-glow hover:scale-105 transition-all duration-300 font-medium shadow-md"
              >
                <Plus className="mr-2 h-5 w-5" />
                New Template
              </Button>
            </div>
          </div>
        </div>

        {/* Templates Content */}
        <Card className="border border-border/50 shadow-2xl backdrop-blur-md bg-card/90 animate-scale-in overflow-hidden">
          <CardContent className="p-8">
            {/* Search Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm font-medium text-primary">
                      <span className="text-lg font-bold">{filteredTemplates.length}</span> {filteredTemplates.length === 1 ? 'template' : 'templates'} {searchQuery && 'found'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground transition-all duration-300 group-focus-within:text-primary group-focus-within:scale-110" />
                <Input
                  type="text"
                  placeholder="Search templates by name or file..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 text-base border-2 border-border/50 focus:border-primary/50 focus:shadow-glow transition-all duration-300 rounded-xl bg-background/50"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-24">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-6 animate-pulse">
                  <FileText className="h-12 w-12 text-primary animate-bounce-gentle" />
                </div>
                <p className="text-muted-foreground text-lg font-medium animate-pulse">Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-24 animate-fade-in">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 mb-6 border-2 border-dashed border-primary/30">
                  <FileText className="h-12 w-12 text-primary/60" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No templates yet</h3>
                <p className="text-muted-foreground mb-8 text-lg">Create your first template to get started with document generation</p>
                <Button 
                  onClick={() => setShowNewTemplateDialog(true)}
                  className="gradient-primary hover:shadow-glow hover:scale-105 transition-all duration-300 font-medium shadow-md h-11 px-8"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Create Template
                </Button>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-24 animate-fade-in">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 mb-6 border-2 border-dashed border-primary/30">
                  <FileText className="h-12 w-12 text-primary/60" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No templates found</h3>
                <p className="text-muted-foreground mb-8 text-lg">Try adjusting your search query</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template, index) => (
                  <div 
                    key={template.id} 
                    className="group relative flex items-center gap-4 p-5 border-2 border-border/50 rounded-2xl hover-lift hover:border-primary/40 hover:shadow-card-hover transition-all duration-300 bg-gradient-to-br from-card to-card/50 backdrop-blur-sm animate-fade-in overflow-hidden"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Hover shimmer effect */}
                    <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 via-primary/15 to-accent/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 border border-primary/20 shadow-sm relative z-10">
                      <FileText className="h-7 w-7 text-primary group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors duration-300 mb-1">
                        {template.template_name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate mb-1">{template.file_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60"></div>
                          {format(new Date(template.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 relative z-10">
                      <Button
                        size="sm"
                        className="h-10 px-5 gradient-primary text-white hover:shadow-glow hover:scale-105 transition-all duration-300 font-medium shadow-md"
                        onClick={() => navigate("/work", { state: { templateId: template.id, templateName: template.template_name } })}
                      >
                        Use Template
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0 border-2 hover:border-primary hover:bg-primary/10 hover:text-primary hover:scale-110 transition-all duration-300"
                        onClick={() => handleDownloadTemplate(template.id, template.file_name, template.template_name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0 border-2 hover:border-destructive hover:bg-destructive/10 hover:text-destructive hover:scale-110 transition-all duration-300"
                        onClick={() => handleDeleteTemplate(template.id, template.template_name, template.file_name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Word Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="sm:max-w-md border-2 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                Upload Word Template
              </DialogTitle>
              <DialogDescription className="text-base">
                Upload an existing Word document as a template for document generation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-6">
              <div className="space-y-3">
                <Label htmlFor="upload-name" className="text-base font-medium">Template Name</Label>
                <Input
                  id="upload-name"
                  placeholder="e.g., Legal Scrutiny Report"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="h-11 border-2"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="upload-file" className="text-base font-medium">Word File (.docx)</Label>
                <Input
                  id="upload-file"
                  type="file"
                  accept=".doc,.docx"
                  onChange={handleFileChange}
                  className="h-11 border-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:font-medium"
                />
                {uploadedFile && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm text-foreground font-medium">
                      {uploadedFile.name}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setTemplateName("");
                  setUploadedFile(null);
                }}
                className="border-2"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUploadTemplate} 
                disabled={isUploading}
                className="gradient-primary hover:shadow-glow hover:scale-105 transition-all duration-300 font-medium shadow-md"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* New Template Dialog */}
        <Dialog open={showNewTemplateDialog} onOpenChange={setShowNewTemplateDialog}>
          <DialogContent className="sm:max-w-md border-2 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-primary/10">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                Create New Template
              </DialogTitle>
              <DialogDescription className="text-base">
                Upload a Word document to create a new template for document generation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-6">
              <div className="space-y-3">
                <Label htmlFor="new-template-name" className="text-base font-medium">Template Name</Label>
                <Input
                  id="new-template-name"
                  placeholder="e.g., Legal Scrutiny Report"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="h-11 border-2"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="new-template-file" className="text-base font-medium">Word File (.docx)</Label>
                <Input
                  id="new-template-file"
                  type="file"
                  accept=".doc,.docx"
                  onChange={handleFileChange}
                  className="h-11 border-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent/10 file:text-primary hover:file:bg-accent/20 file:font-medium"
                />
                {uploadedFile && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm text-foreground font-medium">
                      {uploadedFile.name}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTemplateDialog(false);
                  setTemplateName("");
                  setUploadedFile(null);
                }}
                className="border-2"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUploadTemplate} 
                disabled={isUploading}
                className="gradient-primary hover:shadow-glow hover:scale-105 transition-all duration-300 font-medium shadow-md"
              >
                {isUploading ? "Creating..." : "Create Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Templates;
