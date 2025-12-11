import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, X, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DeedCustomFields from "./DeedCustomFields";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
export interface Deed {
  id: string;
  deed_type: string;
  executed_by: string;
  in_favour_of: string;
  date: string;
  document_number: string;
  nature_of_doc: string;
  custom_fields?: Record<string, string> | any;
  table_type?: string;
}

interface DeedTemplate {
  deed_type: string;
  preview_template: string | null;
  custom_placeholders?: Record<string, string> | any;
}

interface HistoryTemplate {
  deed_type: string;
  template_content: string | null;
}

interface DeedsTableProps {
  sectionTitle?: string;
  tableType?: string;
  copyFromTableType?: string; // Table type to copy from
}

const DeedsTable = ({ sectionTitle = "Description of Documents Scrutinized", tableType = "table", copyFromTableType }: DeedsTableProps) => {
  const [deeds, setDeeds] = useState<Deed[]>([]);
  const [deedTemplates, setDeedTemplates] = useState<DeedTemplate[]>([]);
  const [historyTemplates, setHistoryTemplates] = useState<HistoryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const updateTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const deedsRef = useRef<Deed[]>([]);
  const [customColumns, setCustomColumns] = useState<Array<{name: string, position: string}>>([]);
  const [showColumnDialog, setShowColumnDialog] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [insertAfterColumn, setInsertAfterColumn] = useState<string>("");
  const [customColumnData, setCustomColumnData] = useState<Record<string, Record<string, string>>>({});

  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Load custom columns from localStorage
  useEffect(() => {
    const savedColumns = localStorage.getItem(`customColumns_${tableType}`);
    if (savedColumns) {
      setCustomColumns(JSON.parse(savedColumns));
    }
    const savedData = localStorage.getItem(`customColumnData_${tableType}`);
    if (savedData) {
      setCustomColumnData(JSON.parse(savedData));
    }
  }, [tableType]);

  useEffect(() => {
    // Initialize auth state and subscribe to changes
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Keep deedsRef in sync with deeds state for use in callbacks
  useEffect(() => {
    deedsRef.current = deeds;
  }, [deeds]);

  // Load data and subscribe for current user OR anonymous
  useEffect(() => {
    const userId = currentUser?.id || '00000000-0000-0000-0000-000000000000';
    loadDeedTemplates();
    loadHistoryTemplates();
    loadDeeds();
    const cleanup = setupRealtimeSubscription(userId);
    return cleanup;
  }, [currentUser]);
  const loadDeeds = async () => {
    console.log("Loading deeds for table type:", tableType);

    const query = supabase
      .from("deeds")
      .select("*")
      .order("created_at", { ascending: true });
    
    // Only the first table (tableType="table") should include null values for backward compatibility
    // All other tables should only show their specific table_type
    let data, error;
    if (tableType === "table") {
      ({ data, error } = await query.or(`table_type.eq.${tableType},table_type.is.null`));
    } else {
      ({ data, error } = await query.eq("table_type", tableType));
    }

    if (error) {
      console.error("Error loading deeds:", error);
      toast.error("Failed to load deeds");
      return;
    }
    
    console.log("Raw deeds data from database:", data);

    // For the first table, filter to include both 'table' and null values
    // For other tables, only include the specific table_type
    const filteredData = (data || []).filter(deed => {
      if (tableType === "table") {
        return (deed as any).table_type === tableType || !(deed as any).table_type;
      }
      return (deed as any).table_type === tableType;
    });
    
    console.log("Filtered deeds for table type:", tableType, "count:", filteredData.length);

    setDeeds(filteredData);
    setLoading(false);
  };

  const loadDeedTemplates = async () => {
    const { data, error } = await supabase
      .from("deed_templates")
      .select("deed_type, preview_template, custom_placeholders")
      .order("deed_type");

    if (error) {
      console.error("Error loading deed templates:", error);
      return;
    }

    setDeedTemplates(data || []);
  };

  const loadHistoryTemplates = async () => {
    const { data, error } = await supabase
      .from("history_of_title_templates")
      .select("deed_type, template_content")
      .order("deed_type");

    if (error) {
      console.error("Error loading history templates:", error);
      return;
    }

    setHistoryTemplates(data || []);
  };

  // Extract placeholders from template strings
  const extractPlaceholders = (template: string): string[] => {
    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    const matches = template.matchAll(regex);
    const placeholders = new Set<string>();
    
    for (const match of matches) {
      placeholders.add(match[1]);
    }
    
    return Array.from(placeholders);
  };

  // Get all dynamic placeholders for a deed type
  const getDynamicPlaceholders = (deedType: string): string[] => {
    const previewTemplate = deedTemplates.find(t => t.deed_type === deedType)?.preview_template || "";
    const historyTemplate = historyTemplates.find(t => t.deed_type === deedType)?.template_content || "";
    
    // Combine placeholders from both templates
    const allPlaceholders = new Set<string>();
    
    extractPlaceholders(previewTemplate).forEach(p => allPlaceholders.add(p));
    extractPlaceholders(historyTemplate).forEach(p => allPlaceholders.add(p));
    
    // Exclude standard fields that are already handled separately
    const excludedFields = ['deedType', 'date', 'documentNumber', 'natureOfDoc'];
    
    return Array.from(allPlaceholders).filter(p => !excludedFields.includes(p));
  };

  const setupRealtimeSubscription = (userId: string) => {
    const channel = supabase
      .channel(`deeds-changes-${tableType}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deeds"
        },
        (payload) => {
          const deed = payload.new as Deed;
          const deedTableType = (deed as any).table_type;
          
          // Only process events for deeds that belong to this table
          // For the main table, accept both 'table' and null values
          // For other tables, only accept exact matches
          const shouldInclude = tableType === "table" 
            ? (deedTableType === tableType || !deedTableType)
            : deedTableType === tableType;

          if (!shouldInclude && payload.eventType !== "DELETE") {
            return;
          }

          if (payload.eventType === "INSERT") {
            if (shouldInclude) {
              setDeeds((prev) => [...prev, deed]);
            }
          } else if (payload.eventType === "UPDATE") {
            // Skip update if user is actively editing this deed (has pending timeouts)
            const hasPendingUpdate = Object.keys(updateTimeouts.current).some(key => key.startsWith(deed.id));
            if (hasPendingUpdate) {
              console.log("Skipping realtime update for deed with pending edits:", deed.id);
              return;
            }
            
            setDeeds((prev) =>
              prev.map((d) =>
                d.id === deed.id ? deed : d
              ).filter(d => {
                const tableTypeCheck = (d as any).table_type;
                return tableType === "table" 
                  ? (tableTypeCheck === tableType || !tableTypeCheck)
                  : tableTypeCheck === tableType;
              })
            );
          } else if (payload.eventType === "DELETE") {
            setDeeds((prev) => prev.filter((deed) => deed.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAddDeed = async () => {
    const newDeed = {
      deed_type: "",
      executed_by: "",
      in_favour_of: "",
      date: null,
      document_number: "",
      nature_of_doc: "",
      table_type: tableType,
      user_id: null,
      custom_fields: {}
    };

    const { error } = await supabase.from("deeds").insert(newDeed);

    if (error) {
      console.error("Error adding deed:", error);
      toast.error(`Failed to add deed: ${error.message}`);
    } else {
      toast.success("Deed added");
    }
  };
  const handleRemoveDeed = async (id: string) => {
    const { error } = await supabase.from("deeds").delete().eq("id", id);

    if (error) {
      console.error("Error removing deed:", error);
      toast.error("Failed to remove deed");
    }
  };

  const handleCopyFromPreviousTable = async () => {
    if (!copyFromTableType) return;
    
    try {
      // Fetch deeds from the source table
      // Handle the main table which can have null or 'table' as table_type
      let query = supabase
        .from("deeds")
        .select("*");
      
      if (copyFromTableType === 'table') {
        query = query.or(`table_type.eq.${copyFromTableType},table_type.is.null`);
      } else {
        query = query.eq("table_type", copyFromTableType);
      }
      
      // Order by created_at to preserve the original order
      query = query.order("created_at", { ascending: true });
      
      const { data: sourceDeedsData, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      if (!sourceDeedsData || sourceDeedsData.length === 0) {
        toast.info("No deeds found in the source table to copy");
        return;
      }
      
      // Fetch existing deeds in current table to check what's already been copied
      const { data: existingDeeds, error: existingError } = await supabase
        .from("deeds")
        .select("*")
        .eq("table_type", tableType);
      
      if (existingError) throw existingError;
      
      // Filter out deeds that have already been copied
      // A deed is considered "already copied" if it has the same deed_type, executed_by, 
      // in_favour_of, date, and document_number
      const deedsToInsert = sourceDeedsData.filter(sourceDeed => {
        return !existingDeeds?.some(existingDeed => 
          existingDeed.deed_type === sourceDeed.deed_type &&
          existingDeed.executed_by === sourceDeed.executed_by &&
          existingDeed.in_favour_of === sourceDeed.in_favour_of &&
          existingDeed.date === sourceDeed.date &&
          existingDeed.document_number === sourceDeed.document_number
        );
      });
      
      if (deedsToInsert.length === 0) {
        toast.info("All deeds from source table have already been copied");
        return;
      }
      
      // Insert only new deeds sequentially to preserve order
      for (const sourceDeed of deedsToInsert) {
        const newDeed = {
          deed_type: sourceDeed.deed_type,
          executed_by: sourceDeed.executed_by,
          in_favour_of: sourceDeed.in_favour_of,
          date: sourceDeed.date,
          document_number: sourceDeed.document_number,
          nature_of_doc: sourceDeed.nature_of_doc,
          custom_fields: sourceDeed.custom_fields,
          table_type: tableType,
          user_id: null
        };
        
        const { error: insertError } = await supabase
          .from("deeds")
          .insert(newDeed);
        
        if (insertError) throw insertError;
        
        // Small delay to ensure different timestamps for proper ordering
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      toast.success(`Copied ${deedsToInsert.length} new deed(s) successfully`);
    } catch (error) {
      console.error("Error copying deeds:", error);
      toast.error("Failed to copy deeds from previous table");
    }
  };



  const handleUpdateDeed = useCallback((id: string, field: keyof Deed, value: string | Record<string, string>) => {
    // When deed_type changes, initialize custom_fields from template
    if (field === "deed_type" && typeof value === "string") {
      const template = deedTemplates.find(t => t.deed_type === value);
      const customPlaceholders = template?.custom_placeholders || {};
      
      // Initialize custom_fields with empty strings for all placeholder keys
      const initializedCustomFields: Record<string, string> = {};
      Object.keys(customPlaceholders).forEach(key => {
        initializedCustomFields[key] = "";
      });

      // Update local state with both deed_type and initialized custom_fields
      setDeeds((prev) =>
        prev.map((deed) =>
          deed.id === id 
            ? { ...deed, [field]: value, custom_fields: initializedCustomFields } 
            : deed
        )
      );

      // Update database with both fields
      const timeoutKey = `${id}-${field}`;
      if (updateTimeouts.current[timeoutKey]) {
        clearTimeout(updateTimeouts.current[timeoutKey]);
      }

      updateTimeouts.current[timeoutKey] = setTimeout(async () => {
        const { error } = await supabase
          .from("deeds")
          .update({ [field]: value, custom_fields: initializedCustomFields })
          .eq("id", id);

        if (error) {
          console.error("Error updating deed:", error);
          toast.error("Failed to update deed");
        }
      }, 500);
    } else {
      // Normal field update for other fields
      setDeeds((prev) =>
        prev.map((deed) =>
          deed.id === id ? { ...deed, [field]: value } : deed
        )
      );

      // Clear any existing timeout for this field
      const timeoutKey = `${id}-${field}`;
      if (updateTimeouts.current[timeoutKey]) {
        clearTimeout(updateTimeouts.current[timeoutKey]);
      }

      // Debounce the database update
      updateTimeouts.current[timeoutKey] = setTimeout(async () => {
        // Handle null date properly
        const updateValue = field === "date" && value === "" ? null : value;
        
        const { error } = await supabase
          .from("deeds")
          .update({ [field]: updateValue })
          .eq("id", id);

        if (error) {
          console.error("Error updating deed:", error);
          toast.error("Failed to update deed");
        }
      }, 500);
    }
  }, [deedTemplates]);

  const handleCustomFieldChange = useCallback((deedId: string, fieldKey: string, value: string) => {
    // Update local state immediately
    setDeeds((prev) =>
      prev.map((deed) =>
        deed.id === deedId
          ? { ...deed, custom_fields: { ...(deed.custom_fields as Record<string, string> || {}), [fieldKey]: value } }
          : deed
      )
    );

    // Debounce the database update
    const timeoutKey = `${deedId}-custom_fields`;
    if (updateTimeouts.current[timeoutKey]) {
      clearTimeout(updateTimeouts.current[timeoutKey]);
    }

    updateTimeouts.current[timeoutKey] = setTimeout(async () => {
      // Get the updated deed's custom fields using ref to avoid stale closure
      const deed = deedsRef.current.find(d => d.id === deedId);
      if (!deed) return;

      const updatedCustomFields = { ...(deed.custom_fields as Record<string, string> || {}), [fieldKey]: value };

      const { error } = await supabase
        .from("deeds")
        .update({ custom_fields: updatedCustomFields })
        .eq("id", deedId);

      if (error) {
        console.error("Error updating custom field:", error);
        toast.error("Failed to update custom field");
      }
    }, 500);
  }, []);

  const getPreviewTemplate = (deedType: string): string => {
    const template = deedTemplates.find((t) => t.deed_type === deedType);
    return template?.preview_template || "";
  };

  const generatePreview = (deed: Deed): string => {
    const template = getPreviewTemplate(deed.deed_type);
    let preview = template
      .replace(/{deedType}/g, deed.deed_type)
      .replace(/{executedBy}/gi, deed.executed_by || deed.custom_fields?.executedBy || '')
      .replace(/{inFavourOf}/gi, deed.in_favour_of || deed.custom_fields?.inFavourOf || '')
      .replace(/{date}/g, deed.date)
      .replace(/{documentNumber}/g, deed.document_number)
      .replace(/{natureOfDoc}/g, deed.nature_of_doc)
      .replace(/{extent}/g, deed.custom_fields?.extent || "")
      .replace(/{surveyNo}/g, deed.custom_fields?.surveyNo || "");
    
    // Replace any other custom fields
    if (deed.custom_fields && typeof deed.custom_fields === 'object') {
      Object.entries(deed.custom_fields).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'gi');
        preview = preview.replace(regex, String(value || ""));
      });
    }
    
    return preview;
  };

  const deedTypes = deedTemplates.map((t) => t.deed_type);

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      toast.error("Column name cannot be empty");
      return;
    }
    if (customColumns.some(col => col.name === newColumnName.trim())) {
      toast.error("Column already exists");
      return;
    }
    const newColumn = { name: newColumnName.trim(), position: insertAfterColumn };
    const updatedColumns = [...customColumns, newColumn];
    setCustomColumns(updatedColumns);
    localStorage.setItem(`customColumns_${tableType}`, JSON.stringify(updatedColumns));
    setNewColumnName("");
    setShowColumnDialog(false);
    toast.success(`Column "${newColumnName.trim()}" added`);
  };

  const handleRemoveColumn = (columnName: string) => {
    const updatedColumns = customColumns.filter(col => col.name !== columnName);
    setCustomColumns(updatedColumns);
    localStorage.setItem(`customColumns_${tableType}`, JSON.stringify(updatedColumns));
    
    // Remove data for this column
    const updatedData = { ...customColumnData };
    Object.keys(updatedData).forEach(deedId => {
      delete updatedData[deedId]?.[columnName];
    });
    setCustomColumnData(updatedData);
    localStorage.setItem(`customColumnData_${tableType}`, JSON.stringify(updatedData));
    toast.success(`Column "${columnName}" removed`);
  };

  const handleCustomColumnChange = (deedId: string, columnName: string, value: string) => {
    const updatedData = {
      ...customColumnData,
      [deedId]: {
        ...(customColumnData[deedId] || {}),
        [columnName]: value
      }
    };
    setCustomColumnData(updatedData);
    localStorage.setItem(`customColumnData_${tableType}`, JSON.stringify(updatedData));
  };

  const openColumnDialog = (afterColumn: string) => {
    setInsertAfterColumn(afterColumn);
    setShowColumnDialog(true);
  };

  // Get custom columns for a specific position
  const getColumnsAfter = (position: string) => {
    return customColumns.filter(col => col.position === position);
  };

  return (
    <Card className="shadow-legal">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <CardTitle className="text-legal-header">{sectionTitle}</CardTitle>
          </div>
          {copyFromTableType && (
            <Button
              onClick={handleCopyFromPreviousTable}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Copy from Previous Table
            </Button>
          )}
        </div>
        <CardDescription>Add deeds dynamically - each will generate: &quot;[Deed Type] executed by [Name] in favour of [Name]&quot;</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading deeds...</p>
          </div>
        ) : deeds.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No deeds added yet. Click "Add New Deed" to begin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left text-sm font-semibold bg-white">
                    <div className="flex items-center gap-2">
                      Sno
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openColumnDialog('sno')}
                        className="h-5 w-5 p-0 hover:bg-primary/10"
                        title="Add column after Sno"
                      >
                        <Plus className="h-3 w-3 text-primary" />
                      </Button>
                    </div>
                  </th>
                  {getColumnsAfter('sno').map((col) => (
                    <th key={col.name} className="p-3 text-left text-sm font-semibold bg-white">
                      <div className="flex items-center gap-2">
                        {col.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(col.name)}
                          className="h-5 w-5 p-0 hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-left text-sm font-semibold bg-white">
                    <div className="flex items-center gap-2">
                      Date
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openColumnDialog('date')}
                        className="h-5 w-5 p-0 hover:bg-primary/10"
                        title="Add column after Date"
                      >
                        <Plus className="h-3 w-3 text-primary" />
                      </Button>
                    </div>
                  </th>
                  {getColumnsAfter('date').map((col) => (
                    <th key={col.name} className="p-3 text-left text-sm font-semibold bg-white">
                      <div className="flex items-center gap-2">
                        {col.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(col.name)}
                          className="h-5 w-5 p-0 hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-left text-sm font-semibold bg-white">
                    <div className="flex items-center gap-2">
                      D.No
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openColumnDialog('dno')}
                        className="h-5 w-5 p-0 hover:bg-primary/10"
                        title="Add column after D.No"
                      >
                        <Plus className="h-3 w-3 text-primary" />
                      </Button>
                    </div>
                  </th>
                  {getColumnsAfter('dno').map((col) => (
                    <th key={col.name} className="p-3 text-left text-sm font-semibold bg-white">
                      <div className="flex items-center gap-2">
                        {col.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(col.name)}
                          className="h-5 w-5 p-0 hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-left text-sm font-semibold bg-white">
                    <div className="flex items-center gap-2">
                      Particulars of Deed
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openColumnDialog('particulars')}
                        className="h-5 w-5 p-0 hover:bg-primary/10"
                        title="Add column after Particulars"
                      >
                        <Plus className="h-3 w-3 text-primary" />
                      </Button>
                    </div>
                  </th>
                  {getColumnsAfter('particulars').map((col) => (
                    <th key={col.name} className="p-3 text-left text-sm font-semibold bg-white">
                      <div className="flex items-center gap-2">
                        {col.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(col.name)}
                          className="h-5 w-5 p-0 hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-left text-sm font-semibold bg-white">
                    <div className="flex items-center gap-2">
                      Nature of Doc
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openColumnDialog('nature')}
                        className="h-5 w-5 p-0 hover:bg-primary/10"
                        title="Add column after Nature of Doc"
                      >
                        <Plus className="h-3 w-3 text-primary" />
                      </Button>
                    </div>
                  </th>
                  {getColumnsAfter('nature').map((col) => (
                    <th key={col.name} className="p-3 text-left text-sm font-semibold bg-white">
                      <div className="flex items-center gap-2">
                        {col.name}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveColumn(col.name)}
                          className="h-5 w-5 p-0 hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="p-3 text-center text-sm font-semibold bg-white w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {deeds.map((deed, index) => (
                <tr key={deed.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="p-3 text-sm font-medium">{index + 1}</td>
                    {getColumnsAfter('sno').map((col) => (
                      <td key={col.name} className="p-3">
                        <Input
                          value={customColumnData[deed.id]?.[col.name] || ''}
                          onChange={(e) => handleCustomColumnChange(deed.id, col.name, e.target.value)}
                          placeholder={col.name}
                          className="transition-all duration-200"
                        />
                      </td>
                    ))}
                    <td className="p-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[150px] justify-start text-left font-normal",
                              !deed.date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {deed.date ? format(parse(deed.date, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy') : <span>Nil</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 border-b">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-muted-foreground"
                              onClick={() => handleUpdateDeed(deed.id, "date", "")}
                            >
                              Set as Nil
                            </Button>
                          </div>
                          <Calendar
                            mode="single"
                            selected={deed.date ? parse(deed.date, 'yyyy-MM-dd', new Date()) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                handleUpdateDeed(deed.id, "date", format(date, 'yyyy-MM-dd'));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </td>
                    {getColumnsAfter('date').map((col) => (
                      <td key={col.name} className="p-3">
                        <Input
                          value={customColumnData[deed.id]?.[col.name] || ''}
                          onChange={(e) => handleCustomColumnChange(deed.id, col.name, e.target.value)}
                          placeholder={col.name}
                          className="transition-all duration-200"
                        />
                      </td>
                    ))}
                    <td className="p-3">
                      <Input
                        value={deed.document_number}
                        onChange={(e) => handleUpdateDeed(deed.id, "document_number", e.target.value)}
                        placeholder="Document Number"
                        className="transition-all duration-200"
                      />
                    </td>
                    {getColumnsAfter('dno').map((col) => (
                      <td key={col.name} className="p-3">
                        <Input
                          value={customColumnData[deed.id]?.[col.name] || ''}
                          onChange={(e) => handleCustomColumnChange(deed.id, col.name, e.target.value)}
                          placeholder={col.name}
                          className="transition-all duration-200"
                        />
                      </td>
                    ))}
                    <td className="p-3">
                      <div className="space-y-3">
                        <Select value={deed.deed_type} onValueChange={(value) => handleUpdateDeed(deed.id, "deed_type", value)}>
                          <SelectTrigger className="transition-all duration-200">
                            <SelectValue placeholder="Select deed type" />
                          </SelectTrigger>
                          <SelectContent>
                            {deedTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Dynamic fields based on template placeholders */}
                        {deed.deed_type && getDynamicPlaceholders(deed.deed_type).length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {getDynamicPlaceholders(deed.deed_type).map((placeholder) => {
                              const formatLabel = (key: string) => {
                                return key
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, (str) => str.toUpperCase())
                                  .trim();
                              };
                              
                              // Get value from legacy fields or custom_fields
                              let value = '';
                              if (placeholder === 'executedBy') {
                                value = deed.executed_by || (deed.custom_fields?.executedBy || '');
                              } else if (placeholder === 'inFavourOf') {
                                value = deed.in_favour_of || (deed.custom_fields?.inFavourOf || '');
                              } else {
                                value = deed.custom_fields?.[placeholder] || '';
                              }
                              
                              return (
                                <Input
                                  key={placeholder}
                                  value={value}
                                  onChange={(e) => {
                                    // Update legacy fields for backward compatibility
                                    if (placeholder === 'executedBy') {
                                      handleUpdateDeed(deed.id, "executed_by", e.target.value);
                                    } else if (placeholder === 'inFavourOf') {
                                      handleUpdateDeed(deed.id, "in_favour_of", e.target.value);
                                    }
                                    // Also update in custom_fields
                                    handleCustomFieldChange(deed.id, placeholder, e.target.value);
                                  }}
                                  placeholder={formatLabel(placeholder)}
                                  className="transition-all duration-200"
                                />
                              );
                            })}
                          </div>
                        )}
                        
                        {deed.deed_type && getPreviewTemplate(deed.deed_type).trim() !== "" && (
                          <div className="p-2 bg-muted rounded text-sm">
                            <strong>Preview:</strong> {generatePreview(deed)}
                          </div>
                        )}
                        
                        <DeedCustomFields
                          customPlaceholders={deed.deed_type ? (deedTemplates.find(t => t.deed_type === deed.deed_type)?.custom_placeholders || {}) : {}}
                          customValues={deed.custom_fields || {}}
                          onCustomValueChange={(key, value) => handleCustomFieldChange(deed.id, key, value)}
                        />
                      </div>
                    </td>
                    {getColumnsAfter('particulars').map((col) => (
                      <td key={col.name} className="p-3">
                        <Input
                          value={customColumnData[deed.id]?.[col.name] || ''}
                          onChange={(e) => handleCustomColumnChange(deed.id, col.name, e.target.value)}
                          placeholder={col.name}
                          className="transition-all duration-200"
                        />
                      </td>
                    ))}
                    <td className="p-3">
                      <Select 
                        value={deed.nature_of_doc} 
                        onValueChange={(value) => handleUpdateDeed(deed.id, "nature_of_doc", value)}
                      >
                        <SelectTrigger className="transition-all duration-200">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Original">Original</SelectItem>
                          <SelectItem value="Xerox">Xerox</SelectItem>
                          <SelectItem value="Online Copy">Online Copy</SelectItem>
                          <SelectItem value="Online E-Copy">Online E-Copy</SelectItem>
                          <SelectItem value="SRO Copy">SRO Copy</SelectItem>
                          <SelectItem value="True copy">True copy</SelectItem>
                          <SelectItem value="Photocopy">Photocopy</SelectItem>
                          <SelectItem value="Duplicate of Original">Duplicate of Original</SelectItem>
                          <SelectItem value="Screenshot copy">Screenshot copy</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {getColumnsAfter('nature').map((col) => (
                      <td key={col.name} className="p-3">
                        <Input
                          value={customColumnData[deed.id]?.[col.name] || ''}
                          onChange={(e) => handleCustomColumnChange(deed.id, col.name, e.target.value)}
                          placeholder={col.name}
                          className="transition-all duration-200"
                        />
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDeed(deed.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button
          onClick={handleAddDeed}
          className="w-full bg-primary hover:bg-primary/90 shadow-md transition-all duration-200 hover:shadow-lg"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Deed
        </Button>
      </CardContent>

      <Dialog open={showColumnDialog} onOpenChange={setShowColumnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Column</DialogTitle>
            <DialogDescription>
              Enter a name for your new custom column. It will be added after the "{insertAfterColumn}" column.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="columnName">Column Name</Label>
              <Input
                id="columnName"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g., Location, Status, Notes..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddColumn();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowColumnDialog(false);
              setNewColumnName("");
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn}>
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DeedsTable;
