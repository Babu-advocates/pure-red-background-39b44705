import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Scale, ArrowLeft, Save } from "lucide-react";
import TemplateUpload from "@/components/TemplateUpload";
import PlaceholderInputs from "@/components/PlaceholderInputs";
import DeedsTable, { Deed } from "@/components/DeedsTable";
import DocumentDetailsTable, { DocumentDetail } from "@/components/DocumentDetailsTable";
import GavelAnimation from "@/components/GavelAnimation";

import { toast } from "sonner";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateContent, setTemplateContent] = useState<string>("");
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});
  const [deeds, setDeeds] = useState<Deed[]>([]);
  const [deedsTable2, setDeedsTable2] = useState<Deed[]>([]);
  const [deedsTable3, setDeedsTable3] = useState<Deed[]>([]);
  const [deedsTable4, setDeedsTable4] = useState<Deed[]>([]);
  const [documents, setDocuments] = useState<DocumentDetail[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState("Legal_Scrutiny_Report");
  const [deedTemplates, setDeedTemplates] = useState<Map<string, string>>(new Map());
  const [showGavelAnimation, setShowGavelAnimation] = useState(false);
  // Function to reload draft data from Supabase
  const reloadDraftFromDatabase = async (dId: string) => {
    try {
      const { data, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', dId)
        .maybeSingle();

      if (!error && data) {
        setPlaceholders(((data as any).placeholders) || {});
        setDocuments(((data as any).documents) || []);
        
        if ((data as any).draft_name) {
          setDocumentName((data as any).draft_name);
        }

          // If deeds are stored on the draft, restore them
          const dd: any = (data as any).deeds;
          if (dd && typeof dd === 'object') {
            await restoreDeedsFromDraft(dd as any);
          }
      }
    } catch (error) {
      console.error('Error reloading draft:', error);
    }
  };

  useEffect(() => {
    const cleanup = setupRealtimeSubscription();
    loadAllDeeds();
    loadDeedTemplates();

    const init = async () => {
      // Load template if coming from Templates page or Drafts page
      const state = location.state as {
        templateId?: string;
        templateName?: string;
        draftId?: string;
        draftName?: string;
        draftData?: {
          placeholders: Record<string, string>;
          documents: DocumentDetail[];
          deeds: Deed[];
        };
      } | null;

      const params = new URLSearchParams(location.search);
      const draftId = params.get('draftId');
      const templateIdParam = params.get('templateId');

      if (state?.templateId) {
        setTemplateId(state.templateId);
        setDraftId(state.draftId || null);
        await loadTemplateFromDatabase(state.templateId, state.templateName);

        // Load draft data if coming from drafts page
        if (state.draftData) {
          setPlaceholders(state.draftData.placeholders || {});
          setDocuments(state.draftData.documents || []);
          // Set the draft name if available
          if (state.draftName) {
            setDocumentName(state.draftName);
          }
          // Restore deeds from draft data
          if (state.draftData.deeds) {
            await restoreDeedsFromDraft(state.draftData.deeds);
          }
          toast.success("Draft loaded successfully");
        } else {
          await clearAllDeedsForFreshTemplate();
          loadAllDeeds();
          // Don't clear placeholders - they come from the template itself
          setDocuments([]);
          setDeeds([]);
          toast.info("Starting with a fresh template");
        }
        return;
      }

      // Fallback for reloads/direct links: restore from Supabase using URL params
      if (draftId) {
        setDraftId(draftId);
        await reloadDraftFromDatabase(draftId);
        
        const { data } = await supabase
          .from('drafts')
          .select('template_id')
          .eq('id', draftId)
          .maybeSingle();
          
        if (data) {
          const tId = templateIdParam || (data as any).template_id;
          if (tId) {
            setTemplateId(tId);
            await loadTemplateFromDatabase(tId);
          }
        }
        
        toast.success('Draft restored from database');
        return;
      }

      // Allow users to upload files directly on this page
      // No redirect needed - users can upload templates here
    };

    void init();
    return cleanup;
  }, [location.pathname, location.search]); // React when path or query changes
  
  // Removed periodic reloading - it's unnecessary and causes slowness
  
  const loadAllDeeds = async () => {
    try {
      const { data, error } = await supabase
        .from("deeds")
        .select("*")
        .order("created_at", { ascending: true });
        
      if (error) throw error;
      
      // Separate deeds by table_type
      const allDeeds = data || [];
      setDeeds(allDeeds.filter(d => !(d as any).table_type || (d as any).table_type === 'table'));
      setDeedsTable2(allDeeds.filter(d => (d as any).table_type === 'table2'));
      setDeedsTable3(allDeeds.filter(d => (d as any).table_type === 'table3'));
      setDeedsTable4(allDeeds.filter(d => (d as any).table_type === 'table4'));
    } catch (error) {
      console.error("Error loading deeds:", error);
    }
  };

  const loadDeedTemplates = async () => {
    const { data, error } = await supabase
      .from("deed_templates")
      .select("deed_type, preview_template");

    if (error) {
      console.error("Error loading deed templates:", error);
      return;
    }

    const templateMap = new Map<string, string>();
    (data || []).forEach((t: any) => {
      if (t?.deed_type) {
        templateMap.set(String(t.deed_type).trim().toLowerCase(), t.preview_template || "");
      }
    });
    setDeedTemplates(templateMap);
  };

  const generateDeedParticulars = (deed: Deed): string => {
    const key = String(deed.deed_type || "").trim().toLowerCase();
    const template = deedTemplates.get(key) || "";
    
    let particulars = template
      .replace(/{deedType}/gi, deed.deed_type || "")
      .replace(/{executedBy}/gi, deed.executed_by || "")
      .replace(/{inFavourOf}/gi, deed.in_favour_of || "")
      .replace(/{date}/gi, deed.date || "")
      .replace(/{documentNumber}/gi, deed.document_number || "")
      .replace(/{natureOfDoc}/gi, deed.nature_of_doc || "");

    // Replace custom field placeholders
    if (deed.custom_fields && typeof deed.custom_fields === "object") {
      Object.entries(deed.custom_fields).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, "gi");
        particulars = particulars.replace(regex, String(value ?? ""));
      });
    }

    return particulars;
  };
  // Removed loadDeeds - deeds should only come from drafts or be created fresh
  
  const clearAllDeedsForFreshTemplate = async () => {
    try {
      // Delete all deeds
      const { error } = await supabase
        .from("deeds")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records
        
      if (error) throw error;
    } catch (error) {
      console.error("Error clearing deeds:", error);
    }
  };

  const restoreDeedsFromDraft = async (draftDeeds: Deed[] | { table?: Deed[]; table2?: Deed[]; table3?: Deed[]; table4?: Deed[] }) => {
    try {
      // First clear existing deeds
      await clearAllDeedsForFreshTemplate();

      // Build a flat list preserving table_type
      const toInsert: Array<any> = [];

      const mapDeed = (d: any, tableType: string) => ({
        deed_type: d.deed_type,
        executed_by: d.executed_by,
        in_favour_of: d.in_favour_of,
        date: d.date,
        document_number: d.document_number,
        nature_of_doc: d.nature_of_doc,
        custom_fields: d.custom_fields,
        table_type: tableType,
        user_id: null,
      });

      if (Array.isArray(draftDeeds)) {
        draftDeeds.forEach((d: any) => toInsert.push(mapDeed(d, (d?.table_type) || 'table')));
      } else if (draftDeeds && typeof draftDeeds === 'object') {
        const entries: Array<[string, any[]]> = [
          ['table', draftDeeds.table || []],
          ['table2', draftDeeds.table2 || []],
          ['table3', draftDeeds.table3 || []],
          ['table4', draftDeeds.table4 || []],
        ];
        entries.forEach(([t, arr]) => (arr || []).forEach((d: any) => toInsert.push(mapDeed(d, t))));
      }

      if (toInsert.length) {
        const { error } = await supabase.from('deeds').insert(toInsert);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error restoring deeds from draft:', error);
      toast.error('Failed to restore deeds from draft');
    }
  };
  const loadTemplateFromDatabase = async (templateId: string, name?: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from("document_templates").select("file_data, file_name, template_name").eq("id", templateId).single();
      if (error) throw error;

      // Convert hex string back to File
      const hexString = data.file_data.startsWith('\\x') ? data.file_data.slice(2) : data.file_data;
      const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      const file = new File([blob], data.file_name, {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      setTemplateName(name || data.template_name);
      await handleTemplateUpload(file);
      toast.success(`Template "${name || data.template_name}" loaded successfully`);
    } catch (error) {
      console.error("Error loading template:", error);
      toast.error("Failed to load template");
    }
  };
  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("deeds-changes-index")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "deeds"
      }, payload => {
          console.log("Deed change detected:", payload.eventType);
          
          if (payload.eventType === "INSERT") {
            const newDeed = payload.new as Deed;
            const tableType = (newDeed as any).table_type || 'table';
            
            if (tableType === 'table2') {
              setDeedsTable2(prev => [...prev, newDeed]);
            } else if (tableType === 'table3') {
              setDeedsTable3(prev => [...prev, newDeed]);
            } else if (tableType === 'table4') {
              setDeedsTable4(prev => [...prev, newDeed]);
            } else {
              setDeeds(prev => [...prev, newDeed]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedDeed = payload.new as Deed;
            const tableType = (updatedDeed as any).table_type || 'table';
            
            if (tableType === 'table2') {
              setDeedsTable2(prev => prev.map(deed => deed.id === updatedDeed.id ? updatedDeed : deed));
            } else if (tableType === 'table3') {
              setDeedsTable3(prev => prev.map(deed => deed.id === updatedDeed.id ? updatedDeed : deed));
            } else if (tableType === 'table4') {
              setDeedsTable4(prev => prev.map(deed => deed.id === updatedDeed.id ? updatedDeed : deed));
            } else {
              setDeeds(prev => prev.map(deed => deed.id === updatedDeed.id ? updatedDeed : deed));
            }
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setDeeds(prev => prev.filter(deed => deed.id !== deletedId));
            setDeedsTable2(prev => prev.filter(deed => deed.id !== deletedId));
            setDeedsTable3(prev => prev.filter(deed => deed.id !== deletedId));
            setDeedsTable4(prev => prev.filter(deed => deed.id !== deletedId));
          }
        })
        .subscribe();
    
    return () => {
      supabase.removeAllChannels();
    };
  };
  const handleTemplateUpload = async (file: File) => {
    try {
      console.log("Starting to parse file:", file.name, "Size:", file.size, "Type:", file.type);
      const arrayBuffer = await file.arrayBuffer();
      const zip = new PizZip(arrayBuffer);

      // Read Word XML directly to avoid Docxtemplater compile errors during upload
      const docFile = zip.file("word/document.xml");
      if (!docFile) throw new Error("Invalid .docx: missing word/document.xml");
      let xml = docFile.asText();

      // Merge adjacent text runs to fix split placeholders BEFORE extracting text
      xml = xml.replace(/<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>/g, '');
      xml = xml.replace(/<\/w:t><\/w:r><w:r><w:t>/g, '');

      // Extract human-readable text for placeholder detection
      let text = xml.replace(/<w:p[^>]*>/g, "\n") // new paragraph -> newline
      .replace(/<[^>]+>/g, "") // strip all XML tags
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      setTemplateContent(text);
      setTemplateFile(file);

      // Extract placeholders - single braces {key} for fields, double braces {{table}} for the deeds table
      const singleBraceRegex = /\{([^{}]+)\}/g;
      const doubleTableRegex = /\{\{table\}\}/i;
      const doubleTable1Regex = /\{\{table1\}\}/i;
      const detectedPlaceholders: Record<string, string> = {};

      // Exclude auto-generated table-related fields and history field
      const tableRelatedFields = ["sno", "date", "deed", "deedinfo", "deeds", "table", "table1", "table2", "table3", "table4", "$history", "history"];

      // Extract single-brace placeholders (regular fields) — allow spaces
      const singleMatches = text.matchAll(singleBraceRegex);
      for (const match of singleMatches) {
        const raw = match[1].trim();
        const key = raw;
        // Skip control tags like {#items} or {/items} and table placeholders and history placeholder
        if (/^[#/^$]/.test(key) || key.toLowerCase() === "table" || key.toLowerCase() === "table1" || key.toLowerCase() === "table2" || key.toLowerCase() === "table3" || key.toLowerCase() === "table4" || key.toLowerCase() === "history") continue;
        if (!detectedPlaceholders[key] && !tableRelatedFields.includes(key.toLowerCase())) {
          detectedPlaceholders[key] = "";
        }
      }

      // Warn about unsupported control tags like {#items}/{/items}
      const unsupported = text.match(/\{[#/^].+?\}/g);
      if (unsupported?.length) {
        console.warn("Unsupported control tags detected:", unsupported);
        toast.warning("Template uses unsupported loop/control tags. Use {{table}} for the deeds table.");
      }
      const hasTablePlaceholder = doubleTableRegex.test(text);
      const hasTable1Placeholder = doubleTable1Regex.test(text);
      const hasHistoryPlaceholder = /\{\$history\}/i.test(text);
      console.log("Detected placeholders:", Object.keys(detectedPlaceholders));
      setPlaceholders(detectedPlaceholders);
      toast.success(`Template parsed! Found ${Object.keys(detectedPlaceholders).length} field(s)${hasTablePlaceholder ? ' and {{table}} placeholder' : ''}${hasTable1Placeholder ? ' and {{table1}} placeholder' : ''}${hasHistoryPlaceholder ? ' and {$history} placeholder' : ''}`);
    } catch (error: any) {
      console.error("Upload parse error:", error);
      const errors = error?.properties?.errors;
      if (Array.isArray(errors)) {
        errors.forEach((e: any, i: number) => console.error(`Template error ${i + 1}:`, e?.properties || e));
      }
      let errorMessage = "Failed to parse Word template. ";
      errorMessage += error?.message || "Unknown error";
      toast.error(errorMessage);
    }
  };
  const handlePlaceholderChange = (key: string, value: string) => {
    setPlaceholders(prev => ({
      ...prev,
      [key]: value
    }));
  };
  const generateHistoryOfTitle = async (validDeeds: Deed[]): Promise<string> => {
    if (validDeeds.length === 0) return "";
    const historyParts: string[] = [];
    
    for (let index = 0; index < validDeeds.length; index++) {
      const deed = validDeeds[index];
      if (!deed.deed_type) continue;
      
      // Use the index from the deeds table as serial number (1-based)
      const serialNo = index + 1;

      // Fetch the history template for this deed type
      const {
        data,
        error
      } = await supabase.from("history_of_title_templates").select("template_content").eq("deed_type", deed.deed_type).maybeSingle();
      if (error) {
        console.error("Error fetching history template:", error);
        continue;
      }
      if (data?.template_content) {
        // Replace placeholders in the history template
        let historyText = data.template_content
          .replace(/{executedBy}/g, deed.executed_by || "")
          .replace(/{inFavourOf}/g, deed.in_favour_of || "")
          .replace(/{date}/g, formatDateToDDMMYYYY(deed.date))
          .replace(/{documentNumber}/g, deed.document_number || "")
          .replace(/{deedType}/g, deed.deed_type || "")
          .replace(/{natureOfDoc}/g, deed.nature_of_doc || "")
          .replace(/{extent}/g, deed.custom_fields?.extent || "")
          .replace(/{surveyNo}/g, deed.custom_fields?.surveyNo || "");

        // Replace custom field placeholders
        if (deed.custom_fields && typeof deed.custom_fields === 'object') {
          Object.entries(deed.custom_fields).forEach(([key, value]) => {
            const regex = new RegExp(`\\{${key}\\}`, 'gi');
            historyText = historyText.replace(regex, String(value || ""));
          });
        }
        historyParts.push(historyText);
      }
    }
    return historyParts.join("\n\n");
  };
  const handleDownload = async () => {
    if (!templateFile) {
      toast.error("Please upload a template first");
      return;
    }
    
    // Reload all deeds first to ensure we have the latest data
    await loadAllDeeds();
    
    // Small delay to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log("Download - Current deeds state:", {
      deeds: deeds.length,
      deedsTable2: deedsTable2.length,
      deedsTable3: deedsTable3.length,
      deedsTable4: deedsTable4.length
    });
    
    try {
      const arrayBuffer = await templateFile.arrayBuffer();
      const zip = new PizZip(arrayBuffer);

      // Fix split placeholders in Word XML
      const docXmlFile = zip.file("word/document.xml");
      if (!docXmlFile) {
        throw new Error("Invalid Word document structure");
      }
      let xml = docXmlFile.asText();

      // Merge adjacent text runs to fix split placeholders
      xml = xml.replace(/<\/w:t><\/w:r><w:r[^>]*><w:t[^>]*>/g, '');
      xml = xml.replace(/<\/w:t><\/w:r><w:r><w:t>/g, '');

      // Normalize {{table}} to {table} and {{table1}} to {table1}
      xml = xml.replace(/\{\{table\}\}/gi, "{table}");
      xml = xml.replace(/\{\{table1\}\}/gi, "{table1}");

      // Replace {table} placeholder with actual Word table XML BEFORE Docxtemplater processes it
      // Fetch latest deeds directly from database to avoid state sync issues
      const { data: allDeedsData, error: deedsError } = await supabase
        .from("deeds")
        .select("*")
        .order("created_at", { ascending: true });
        
      if (deedsError) {
        console.error("Error fetching deeds:", deedsError);
        toast.error("Failed to fetch deeds");
        return;
      }
      
      const allDeedsFromDb = allDeedsData || [];
      const mainTableDeeds = allDeedsFromDb.filter(d => !(d as any).table_type || (d as any).table_type === 'table');
      const validDeeds = mainTableDeeds.filter(deed => {
        if (!deed.deed_type) return false;
        const key = String(deed.deed_type).trim().toLowerCase();
        const template = deedTemplates.get(key) || "";
        return template.trim() !== ""; // Only include deeds with non-empty preview templates
      });
      
      // Load custom columns from localStorage for each table
      const customColumnsTable = JSON.parse(localStorage.getItem('customColumns_table') || '[]') as Array<{name: string, position: string}>;
      const customColumnDataTable = JSON.parse(localStorage.getItem('customColumnData_table') || '{}');
      const customColumnsTable2 = JSON.parse(localStorage.getItem('customColumns_table2') || '[]') as Array<{name: string, position: string}>;
      const customColumnDataTable2 = JSON.parse(localStorage.getItem('customColumnData_table2') || '{}');
      const customColumnsTable3 = JSON.parse(localStorage.getItem('customColumns_table3') || '[]') as Array<{name: string, position: string}>;
      const customColumnDataTable3 = JSON.parse(localStorage.getItem('customColumnData_table3') || '{}');
      const customColumnsTable4 = JSON.parse(localStorage.getItem('customColumns_table4') || '[]') as Array<{name: string, position: string}>;
      const customColumnDataTable4 = JSON.parse(localStorage.getItem('customColumnData_table4') || '{}');
      
      console.log("Deeds from database:", {
        total: allDeedsFromDb.length,
        mainTable: mainTableDeeds.length,
        valid: validDeeds.length
      });
      if (validDeeds.length > 0) {
        const tableXml = generateWordTableXml(validDeeds, customColumnsTable, customColumnDataTable, 'table');
        // Close the paragraph before table, insert table, open new paragraph after
        xml = xml.replace(/\{table\}/gi, '</w:t></w:r></w:p>' + tableXml + '<w:p><w:r><w:t>');
      } else {
        // Replace with simple text if no deeds
        xml = xml.replace(/\{table\}/gi, 'No deeds added yet');
      }

      // Replace {table1} placeholder with ALL document details
      if (documents.length > 0) {
        const docTableXml = generateDocumentDetailsWordTableXml(documents);
        xml = xml.replace(/\{table1\}/gi, '</w:t></w:r></w:p>' + docTableXml + '<w:p><w:r><w:t>');
      } else {
        xml = xml.replace(/\{table1\}/gi, 'No document details added yet');
      }

      // Replace {table2} with deeds from table2 (or first document as fallback)
      const table2Deeds = allDeedsFromDb.filter(d => (d as any).table_type === 'table2');
      const validDeeds2 = table2Deeds.filter(deed => {
        if (!deed.deed_type) return false;
        const key = String(deed.deed_type).trim().toLowerCase();
        const template = deedTemplates.get(key) || "";
        return template.trim() !== ""; // Only include deeds with non-empty preview templates
      });
      
      if (validDeeds2.length > 0) {
        const table2Xml = generateWordTableXml(validDeeds2, customColumnsTable2, customColumnDataTable2, 'table2');
        xml = xml.replace(/\{table2\}/gi, '</w:t></w:r></w:p>' + table2Xml + '<w:p><w:r><w:t>');
      } else if (documents.length > 0) {
        const firstDocXml = generateDocumentDetailsWordTableXml([documents[0]]);
        xml = xml.replace(/\{table2\}/gi, '</w:t></w:r></w:p>' + firstDocXml + '<w:p><w:r><w:t>');
      } else {
        xml = xml.replace(/\{table2\}/gi, 'No document details added yet');
      }

      // Replace {table3} with deeds from table3 (or second document as fallback)
      const table3Deeds = allDeedsFromDb.filter(d => (d as any).table_type === 'table3');
      const validDeeds3 = table3Deeds.filter(deed => {
        if (!deed.deed_type) return false;
        const key = String(deed.deed_type).trim().toLowerCase();
        const template = deedTemplates.get(key) || "";
        return template.trim() !== ""; // Only include deeds with non-empty preview templates
      });
      
      if (validDeeds3.length > 0) {
        const table3Xml = generateWordTableXml(validDeeds3, customColumnsTable3, customColumnDataTable3, 'table3');
        xml = xml.replace(/\{table3\}/gi, '</w:t></w:r></w:p>' + table3Xml + '<w:p><w:r><w:t>');
      } else if (documents.length > 1) {
        const secondDocXml = generateDocumentDetailsWordTableXml([documents[1]]);
        xml = xml.replace(/\{table3\}/gi, '</w:t></w:r></w:p>' + secondDocXml + '<w:p><w:r><w:t>');
      } else {
        xml = xml.replace(/\{table3\}/gi, 'No second document added yet');
      }

      // Replace {table4} with deeds from table4 (or third document as fallback)
      const table4Deeds = allDeedsFromDb.filter(d => (d as any).table_type === 'table4');
      const validDeeds4 = table4Deeds.filter(deed => {
        if (!deed.deed_type) return false;
        const key = String(deed.deed_type).trim().toLowerCase();
        const template = deedTemplates.get(key) || "";
        return template.trim() !== ""; // Only include deeds with non-empty preview templates
      });
      
      if (validDeeds4.length > 0) {
        const table4Xml = generateWordTableXml(validDeeds4, customColumnsTable4, customColumnDataTable4, 'table4');
        xml = xml.replace(/\{table4\}/gi, '</w:t></w:r></w:p>' + table4Xml + '<w:p><w:r><w:t>');
      } else if (documents.length > 2) {
        const thirdDocXml = generateDocumentDetailsWordTableXml([documents[2]]);
        xml = xml.replace(/\{table4\}/gi, '</w:t></w:r></w:p>' + thirdDocXml + '<w:p><w:r><w:t>');
      } else {
        xml = xml.replace(/\{table4\}/gi, 'No third document added yet');
      }

      // Generate and replace {$history} placeholder - use ALL deeds, not just validDeeds
      const historyContent = await generateHistoryOfTitle(mainTableDeeds);
      if (historyContent) {
        // Split history content into lines and create proper Word XML paragraphs with Cambria 12pt
        const lines = historyContent.split('\n');
        const historyXml = lines.map(line => {
          const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
          return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapedLine}</w:t></w:r></w:p>`;
        }).join('');

        // Replace {$history} - close current paragraph, insert history paragraphs, open new paragraph
        xml = xml.replace(/\{\$history\}/gi, `</w:t></w:r></w:p>${historyXml}<w:p><w:r><w:t>`);
      } else {
        xml = xml.replace(/\{\$history\}/gi, '');
      }

      // Update the XML in the zip
      zip.file("word/document.xml", xml);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ""
      });

      // Prepare data for replacement (only regular placeholders now, table is already replaced)
      const data: Record<string, any> = {
        ...placeholders
      };
      doc.render(data);
      const output = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      saveAs(output, `${documentName}.docx`);
      toast.success("Document downloaded successfully");
    } catch (error) {
      console.error("Error generating document:", error);
      toast.error("Failed to generate document");
    }
  };

  const handleSaveAsDraft = async (e?: React.MouseEvent) => {
    // Prevent any default behavior that might cause reload
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!templateId) {
      toast.error("No template loaded");
      return;
    }

    try {
      const draftName = documentName || `Draft - ${templateName} - ${new Date().toLocaleDateString()}`;
      
      // Get the latest state of all data without reloading
      const currentPlaceholders = { ...placeholders };
      const currentDocuments = [...documents];

      // Fetch the latest deeds from database (since DeedsTable manages its own state)
      const { data: allDeeds, error: deedsError } = await supabase
        .from("deeds")
        .select("*")
        .order("created_at", { ascending: true });

      if (deedsError) {
        console.error("Error fetching deeds:", deedsError);
        toast.error("Failed to fetch current deeds");
        return;
      }

      // Prepare deeds payload grouped by table type from database
      const minify = (d: any) => ({
        deed_type: d.deed_type,
        executed_by: d.executed_by,
        in_favour_of: d.in_favour_of,
        date: d.date,
        document_number: d.document_number,
        nature_of_doc: d.nature_of_doc,
        custom_fields: d.custom_fields,
      });

      const draftDeedsPayload = {
        table: (allDeeds || []).filter(d => !d.table_type || d.table_type === 'table').map(minify),
        table2: (allDeeds || []).filter(d => d.table_type === 'table2').map(minify),
        table3: (allDeeds || []).filter(d => d.table_type === 'table3').map(minify),
        table4: (allDeeds || []).filter(d => d.table_type === 'table4').map(minify),
      } as any;
      
      console.log("Saving draft with data:", {
        draft_id: draftId,
        template_id: templateId,
        draft_name: draftName,
        placeholders: currentPlaceholders,
        documents: currentDocuments,
        deeds_table: (draftDeedsPayload.table || []).length,
        deeds_table2: (draftDeedsPayload.table2 || []).length,
        deeds_table3: (draftDeedsPayload.table3 || []).length,
        deeds_table4: (draftDeedsPayload.table4 || []).length,
      });
      
      // If we have a draftId, UPDATE the existing draft. Otherwise, INSERT a new one.
      if (draftId) {
        const { data, error } = await supabase
          .from("drafts")
          .update({
            draft_name: draftName,
            placeholders: currentPlaceholders as any,
            documents: currentDocuments as any,
            deeds: draftDeedsPayload as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId)
          .select()
          .single();

        if (error) {
          console.error("Draft update error:", error);
          throw error;
        }

        console.log("Draft updated successfully");
        toast.success(`Draft "${draftName}" updated successfully`);
        return data;
      } else {
        const { data, error } = await supabase
          .from("drafts")
          .insert({
            template_id: templateId,
            draft_name: draftName,
            placeholders: currentPlaceholders as any,
            documents: currentDocuments as any,
            deeds: draftDeedsPayload as any,
          })
          .select()
          .single();

        if (error) {
          console.error("Draft save error:", error);
          throw error;
        }

        console.log("Draft saved successfully");
        toast.success(`Draft "${draftName}" saved successfully`);
        
        // Set the draftId so subsequent saves update the same draft
        setDraftId(data.id);
        return data;
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    }
  };

  const escapeXml = (text: string): string => {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };
  
  const formatDateToDDMMYYYY = (dateString: string): string => {
    if (!dateString) return 'Nil';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };
  
  const generateWordTableXml = (validDeeds: Deed[], customColumns: Array<{name: string, position: string}> = [], customColumnData: Record<string, Record<string, string>> = {}, tableType: string = 'table') => {
    // Define column order and get columns for each position
    const columnPositions = ['sno', 'date', 'dno', 'particulars', 'nature'];
    const getColumnsAfter = (position: string) => customColumns.filter(col => col.position === position);
    
    // Calculate total columns
    const baseColumns = 5;
    const totalCustomColumns = customColumns.length;
    const totalColumns = baseColumns + totalCustomColumns;
    
    // Base widths for standard columns
    const baseWidths = {
      sno: 600,
      date: 1500,
      dno: 1300,
      particulars: 4500,
      nature: 1100
    };
    
    // Calculate custom column width
    const customColumnWidth = totalCustomColumns > 0 ? 1200 : 0;
    
    // Generate grid columns
    let gridCols = '';
    gridCols += `<w:gridCol w:w="${baseWidths.sno}"/>`;
    getColumnsAfter('sno').forEach(() => gridCols += `<w:gridCol w:w="${customColumnWidth}"/>`);
    gridCols += `<w:gridCol w:w="${baseWidths.date}"/>`;
    getColumnsAfter('date').forEach(() => gridCols += `<w:gridCol w:w="${customColumnWidth}"/>`);
    gridCols += `<w:gridCol w:w="${baseWidths.dno}"/>`;
    getColumnsAfter('dno').forEach(() => gridCols += `<w:gridCol w:w="${customColumnWidth}"/>`);
    gridCols += `<w:gridCol w:w="${baseWidths.particulars}"/>`;
    getColumnsAfter('particulars').forEach(() => gridCols += `<w:gridCol w:w="${customColumnWidth}"/>`);
    gridCols += `<w:gridCol w:w="${baseWidths.nature}"/>`;
    getColumnsAfter('nature').forEach(() => gridCols += `<w:gridCol w:w="${customColumnWidth}"/>`);
    
    // Generate header row
    let headerRow = `<w:tr>`;
    
    // Sno header
    headerRow += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.sno}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Sno</w:t></w:r></w:p></w:tc>`;
    getColumnsAfter('sno').forEach(col => {
      headerRow += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(col.name)}</w:t></w:r></w:p></w:tc>`;
    });
    
    // Date header
    headerRow += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.date}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Date</w:t></w:r></w:p></w:tc>`;
    getColumnsAfter('date').forEach(col => {
      headerRow += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(col.name)}</w:t></w:r></w:p></w:tc>`;
    });
    
    // D.No header
    headerRow += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.dno}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>D.No</w:t></w:r></w:p></w:tc>`;
    getColumnsAfter('dno').forEach(col => {
      headerRow += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(col.name)}</w:t></w:r></w:p></w:tc>`;
    });
    
    // Particulars header
    headerRow += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.particulars}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Particulars of Deed</w:t></w:r></w:p></w:tc>`;
    getColumnsAfter('particulars').forEach(col => {
      headerRow += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(col.name)}</w:t></w:r></w:p></w:tc>`;
    });
    
    // Nature header
    headerRow += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.nature}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Nature of Doc</w:t></w:r></w:p></w:tc>`;
    getColumnsAfter('nature').forEach(col => {
      headerRow += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(col.name)}</w:t></w:r></w:p></w:tc>`;
    });
    
    headerRow += `</w:tr>`;
    
    // Generate data rows
    let tableRows = '';
    validDeeds.forEach((deed, index) => {
      const sno = escapeXml((index + 1).toString());
      const date = escapeXml(formatDateToDDMMYYYY(deed.date));
      const docNo = escapeXml(deed.document_number || '-');
      const deedInfo = escapeXml(generateDeedParticulars(deed));
      const nature = escapeXml(deed.nature_of_doc || '-');
      
      tableRows += `<w:tr>`;
      
      // Sno cell
      tableRows += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.sno}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${sno}</w:t></w:r></w:p></w:tc>`;
      getColumnsAfter('sno').forEach(col => {
        const customValue = escapeXml(customColumnData[deed.id]?.[col.name] || '-');
        tableRows += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${customValue}</w:t></w:r></w:p></w:tc>`;
      });
      
      // Date cell
      tableRows += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.date}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${date}</w:t></w:r></w:p></w:tc>`;
      getColumnsAfter('date').forEach(col => {
        const customValue = escapeXml(customColumnData[deed.id]?.[col.name] || '-');
        tableRows += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${customValue}</w:t></w:r></w:p></w:tc>`;
      });
      
      // D.No cell
      tableRows += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.dno}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${docNo}</w:t></w:r></w:p></w:tc>`;
      getColumnsAfter('dno').forEach(col => {
        const customValue = escapeXml(customColumnData[deed.id]?.[col.name] || '-');
        tableRows += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${customValue}</w:t></w:r></w:p></w:tc>`;
      });
      
      // Particulars cell
      tableRows += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.particulars}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${deedInfo}</w:t></w:r></w:p></w:tc>`;
      getColumnsAfter('particulars').forEach(col => {
        const customValue = escapeXml(customColumnData[deed.id]?.[col.name] || '-');
        tableRows += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${customValue}</w:t></w:r></w:p></w:tc>`;
      });
      
      // Nature cell
      tableRows += `<w:tc><w:tcPr><w:tcW w:w="${baseWidths.nature}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${nature}</w:t></w:r></w:p></w:tc>`;
      getColumnsAfter('nature').forEach(col => {
        const customValue = escapeXml(customColumnData[deed.id]?.[col.name] || '-');
        tableRows += `<w:tc><w:tcPr><w:tcW w:w="${customColumnWidth}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${customValue}</w:t></w:r></w:p></w:tc>`;
      });
      
      tableRows += `</w:tr>`;
    });
    
    return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr><w:tblGrid>${gridCols}</w:tblGrid>${headerRow}${tableRows}</w:tbl>`;
  };

  const generateDocumentDetailsWordTableXml = (docs: DocumentDetail[]) => {
    let allTablesXml = '';
    
    docs.forEach((doc, docIndex) => {
      // Add spacing between documents
      if (docIndex > 0) {
        allTablesXml += '<w:p><w:r><w:t></w:t></w:r></w:p><w:p><w:r><w:t></w:t></w:r></w:p>';
      }

      // Add heading with Cambria font
      allTablesXml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="280" w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>As per Doc No : ${escapeXml(doc.docNo || '(As per Doc No)')}</w:t></w:r></w:p>`;

      // Build custom measurement rows
      const customMeasurementRows = doc.customMeasurements && Object.keys(doc.customMeasurements).length > 0 
        ? Object.entries(doc.customMeasurements).map(([label, value]) => 
            `<w:tr><w:tc><w:tcPr><w:tcW w:w="700" w:type="dxa"/><w:tcMar><w:top w:w="200" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="200" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t></w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4150" w:type="dxa"/><w:tcMar><w:top w:w="200" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="200" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(label)}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4150" w:type="dxa"/><w:tcMar><w:top w:w="200" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="200" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(String(value || ''))}</w:t></w:r></w:p></w:tc></w:tr>`
          ).join('') 
        : '';

      // Single unified table with all information
      const unifiedTableXml = `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="12" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="700"/><w:gridCol w:w="4150"/><w:gridCol w:w="4150"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="700" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>i</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4150" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Survey No</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="4150" w:type="dxa"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.surveyNo || '(Survey No)')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>ii</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>As per Revenue Record</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.asPerRevenueRecord || '(As per Revenue Record)')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>iii</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Total Extent</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.totalExtent || '(Total Extent)')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>iv</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Plot No</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.plotNo || '(Plot No)')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>v</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>Location</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.location || '(Location like name of the place, village, city registration, sub-district etc.)')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="3"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="280" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="280" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="140"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="26"/></w:rPr><w:t>Boundaries for ${escapeXml(doc.totalExtentSqFt || '(Total Extent)')} Sq.Ft of land</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>North By:</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t> ${escapeXml(doc.northBy || '(North By)')}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>South By:</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t> ${escapeXml(doc.southBy || '(South By)')}</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>East By:</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t> ${escapeXml(doc.eastBy || '(East By)')}</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>West By:</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t> ${escapeXml(doc.westBy || '(West By)')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:gridSpan w:val="3"/><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="280" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="200" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:spacing w:after="140"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="26"/></w:rPr><w:t>Measurement Details</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>vi</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>North - East West</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.northMeasurement || '30 ft')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>vii</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>South - East West</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.southMeasurement || '30 ft')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>viii</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>East - South North</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.eastMeasurement || '40 ft')}</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>ix</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>West - South North</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="220" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="220" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(doc.westMeasurement || '40 ft')}</w:t></w:r></w:p></w:tc></w:tr>${customMeasurementRows}<w:tr><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="240" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="240" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="26"/></w:rPr><w:t>x</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="240" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="240" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="26"/></w:rPr><w:t>Total Extent</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:shd w:fill="FFFFFF"/><w:tcMar><w:top w:w="240" w:type="dxa"/><w:left w:w="150" w:type="dxa"/><w:bottom w:w="240" w:type="dxa"/><w:right w:w="150" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="26"/></w:rPr><w:t>${escapeXml(doc.totalExtentSqFt || '1200 Sq.Ft')}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;

      allTablesXml += unifiedTableXml;
    });

    return allTablesXml;
  };

  return <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground py-8 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 shimmer opacity-30"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/templates")} 
                className="text-primary-foreground hover:bg-background/10 hover-scale transition-all duration-300"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <Scale className="h-10 w-10 animate-[pulse_3s_ease-in-out_infinite]" />
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text">Babu Advocate</h1>
                <p className="text-primary-foreground/90 mt-2 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>Professional Document Generation System</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Introduction Card */}
        

        {/* Template Upload */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <TemplateUpload onTemplateUpload={handleTemplateUpload} isUploaded={!!templateFile} />
        </div>

        {/* Placeholder Inputs */}
        {Object.keys(placeholders).length > 0 && (
          <div className="animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <PlaceholderInputs placeholders={placeholders} onPlaceholderChange={handlePlaceholderChange} />
          </div>
        )}

        {/* Description of Property */}
        <div className="animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
          <DocumentDetailsTable documents={documents} onDocumentsChange={setDocuments} />
        </div>

        {/* Deeds Tables */}
        <div className="animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
          <DeedsTable sectionTitle="Description of Documents Scrutinized" tableType="table" />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
          <DeedsTable sectionTitle="Description of Documents Scrutinized 1" tableType="table2" copyFromTableType="table" />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
          <DeedsTable sectionTitle="Description of Documents Scrutinized 2" tableType="table3" copyFromTableType="table2" />
        </div>
        <div className="animate-fade-in" style={{ animationDelay: '0.7s', animationFillMode: 'both' }}>
          <DeedsTable sectionTitle="Description of Documents Scrutinized 3" tableType="table4" copyFromTableType="table3" />
        </div>


        {/* Action Buttons */}
        <div className="animate-fade-in" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
          <Card className="shadow-2xl hover:shadow-3xl transition-all duration-500 border-2 hover:border-primary/20 bg-gradient-to-br from-card via-card to-muted/5">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Export Report
              </CardTitle>
              <CardDescription className="text-base">Download or email the generated legal scrutiny report</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="documentName" className="text-base font-medium">Document Name</Label>
                <Input
                  id="documentName"
                  type="text"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                  className="max-w-md h-12 transition-all duration-200 focus:scale-[1.02] border-2 focus:border-primary"
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button 
                  onClick={(e) => handleSaveAsDraft(e)} 
                  type="button"
                  variant="outline" 
                  className="shadow-md transition-all duration-300 hover:shadow-xl hover-scale border-2 hover:border-primary h-12 px-6 text-base font-medium"
                >
                  <Save className="mr-2 h-5 w-5" />
                  Save as Draft
                </Button>
                <Button 
                  onClick={handleDownload} 
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-2xl transition-all duration-300 hover-scale h-12 px-6 text-base font-medium"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download as PDF/Word
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-t from-muted to-background py-8 mt-12 border-t-2 border-border/50 animate-fade-in">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Scale className="h-5 w-5 text-primary" />
            <p className="text-muted-foreground text-base font-medium">© 2025 Babu Advocate</p>
          </div>
          <p className="text-muted-foreground/70 text-sm">Professional Document Management System</p>
        </div>
      </footer>
      
      {/* Gavel Animation Overlay */}
      <GavelAnimation isVisible={showGavelAnimation} />
    </div>;
};
export default Index;