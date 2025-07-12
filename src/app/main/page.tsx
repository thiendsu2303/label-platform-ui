"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, Save, Trash2, Zap, Menu, FolderOpen, Eye, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { AppHeader } from "@/components/header"

interface Annotation {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: "Button" | "Input" | "Radio" | "Drop"
}

interface Point {
  x: number
  y: number
}

interface SavedProject {
  id: string
  name: string
  image: string
  annotations: Annotation[]
  createdAt: string
  updatedAt: string
}

const LABEL_COLORS = {
  Button: "border-blue-500",
  Input: "border-green-500",
  Radio: "border-purple-500",
  Drop: "border-orange-500",
}

const LABEL_BG_COLORS = {
  Button: "bg-blue-500",
  Input: "bg-green-500",
  Radio: "bg-purple-500",
  Drop: "bg-orange-500",
}

const LABEL_VARIANTS = {
  Button: "default",
  Input: "secondary",
  Radio: "outline",
  Drop: "destructive",
} as const

export default function UIAnnotationApp() {
  const router = useRouter()
  const [image, setImage] = useState<string | null>(null)
  const [currentProjectName, setCurrentProjectName] = useState<string>("")
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [currentBox, setCurrentBox] = useState<Omit<Annotation, "id" | "label"> | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<Annotation["label"]>("Button")
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false)
  const [isProjectsOpen, setIsProjectsOpen] = useState(false)
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false)
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("")
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [pendingImageFile, setPendingImageFile] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load saved projects from API on mount
  useEffect(() => {
    fetchProjectsFromAPI()
  }, [])

  // Function to fetch projects from API
  const fetchProjectsFromAPI = useCallback(async () => {
    try {
      setIsLoadingProjects(true)
      
      const response = await fetch('http://localhost:8080/api/v1/images/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`)
      }

      const data = await response.json()
      
      // Transform API data to match our SavedProject interface
      const transformedProjects: SavedProject[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        image: item.image_url, // Use MinIO URL from API
        annotations: item.ground_truth?.annotations || [],
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }))

      setSavedProjects(transformedProjects)
      
      toast("Projects loaded", {
        description: `Loaded ${transformedProjects.length} projects from server.`,
      })
    } catch (error) {
      console.error('Error fetching projects:', error)
      toast("Failed to load projects", {
        description: error instanceof Error ? error.message : "Could not load projects from server",
      })
      
      // Fallback to localStorage if API fails
      const saved = localStorage.getItem("ui-annotation-projects")
      if (saved) {
        try {
          setSavedProjects(JSON.parse(saved))
        } catch (localError) {
          console.error("Error loading from localStorage:", localError)
        }
      }
    } finally {
      setIsLoadingProjects(false)
    }
  }, [])

  // Save projects to localStorage whenever savedProjects changes
  useEffect(() => {
    localStorage.setItem("ui-annotation-projects", JSON.stringify(savedProjects))
  }, [savedProjects])

  // Track unsaved changes
  useEffect(() => {
    // Set hasUnsavedChanges to true if there's an image with project name but no annotations
    if (image && currentProjectName && annotations.length === 0) {
      setHasUnsavedChanges(true)
      console.log("Has unsaved changes: true", { image: !!image, projectName: currentProjectName, annotationsCount: annotations.length })
    } else {
      setHasUnsavedChanges(false)
      console.log("Has unsaved changes: false", { image: !!image, projectName: currentProjectName, annotationsCount: annotations.length })
    }
  }, [image, currentProjectName, annotations])

  // Add beforeunload event listener
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = "You haven't labeled anything yet. Do you want to save this project? If yes, it will be saved with empty annotations."
        return "You haven't labeled anything yet. Do you want to save this project? If yes, it will be saved with empty annotations."
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // Handle navigation with unsaved changes
  useEffect(() => {
    const handleBeforeNavigate = () => {
      if (hasUnsavedChanges) {
        // For browser back/forward, we'll use the simple confirm
        // since we can't show custom dialog during page unload
        const confirmed = window.confirm("You haven't labeled anything yet. Do you want to save this project? If yes, it will be saved with empty annotations.")
        if (confirmed) {
          // Auto-save the project with empty annotations
          if (image && currentProjectName && currentProjectId) {
            const projectData: SavedProject = {
              id: currentProjectId,
              name: currentProjectName,
              image,
              annotations: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            // Save to localStorage directly since we can't update state during unload
            const saved = localStorage.getItem("ui-annotation-projects")
            const projects = saved ? JSON.parse(saved) : []
            const existingIndex = projects.findIndex((p: SavedProject) => p.id === currentProjectId)
            
            if (existingIndex >= 0) {
              projects[existingIndex] = { ...projectData, createdAt: projects[existingIndex].createdAt }
            } else {
              projects.push(projectData)
            }
            
            localStorage.setItem("ui-annotation-projects", JSON.stringify(projects))
          }
        }
      }
    }

    // Listen for popstate events (back/forward navigation)
    window.addEventListener("popstate", handleBeforeNavigate)
    
    return () => {
      window.removeEventListener("popstate", handleBeforeNavigate)
    }
  }, [hasUnsavedChanges, image, currentProjectName, currentProjectId])

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = e.target?.result as string
        setPendingImageFile(imageData)
        setIsNameDialogOpen(true)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleProjectNameSubmit = useCallback(() => {
    if (projectName.trim() && pendingImageFile) {
      setImage(pendingImageFile)
      setCurrentProjectName(projectName.trim())
      setCurrentProjectId(Date.now().toString())
      setAnnotations([])
      setIsNameDialogOpen(false)
      setProjectName("")
      setPendingImageFile(null)

      toast("Project created", {
        description: `Project "${projectName.trim()}" has been created.`,
      })
    }
  }, [projectName, pendingImageFile])

  const getRelativeCoordinates = useCallback((event: React.MouseEvent) => {
    if (!imageRef.current || !containerRef.current) return { x: 0, y: 0 }

    const rect = imageRef.current.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }, [])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!image) return

      const point = getRelativeCoordinates(event)
      setIsDrawing(true)
      setStartPoint(point)
      setCurrentBox(null)
    },
    [image, getRelativeCoordinates],
  )

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDrawing || !startPoint || !imageRef.current) return

      const currentPoint = getRelativeCoordinates(event)
      const box = {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width: Math.abs(currentPoint.x - startPoint.x),
        height: Math.abs(currentPoint.y - startPoint.y),
      }

      setCurrentBox(box)
    },
    [isDrawing, startPoint, getRelativeCoordinates],
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentBox || currentBox.width < 10 || currentBox.height < 10) {
      setIsDrawing(false)
      setStartPoint(null)
      setCurrentBox(null)
      return
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      ...currentBox,
      label: selectedLabel,
    }

    setAnnotations((prev) => [...prev, newAnnotation])
    setIsDrawing(false)
    setStartPoint(null)
    setCurrentBox(null)

    toast("Annotation added", {
      description: `${selectedLabel} annotation created successfully.`,
    })
  }, [isDrawing, currentBox, selectedLabel])

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== id))
    setSelectedAnnotation(null)
    toast("Annotation deleted", {
      description: "Annotation removed successfully.",
    })
  }, [])

  const clearAllAnnotations = useCallback(() => {
    setAnnotations([])
    setSelectedAnnotation(null)
    toast("All annotations cleared", {
      description: "All annotations have been removed.",
    })
  }, [])

  // Function to upload image to backend
  const uploadImageToBackend = useCallback(async (imageFile: File, groundTruth?: any) => {
    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('image', imageFile)
      
      if (groundTruth) {
        formData.append('ground_truth', JSON.stringify(groundTruth))
      }

      const response = await fetch('http://localhost:8080/api/v1/images/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      const result = await response.json()
      
      toast("Image uploaded successfully", {
        description: `Image "${result.name}" has been uploaded to the server.`,
      })

      return result
    } catch (error) {
      console.error('Upload error:', error)
      toast("Upload failed", {
        description: error instanceof Error ? error.message : "Failed to upload image",
      })
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [])

  // Function to convert base64 to File object
  const base64ToFile = useCallback((base64String: string, filename: string): File => {
    const arr = base64String.split(',')
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    
    return new File([u8arr], filename, { type: mime })
  }, [])

  const saveProject = useCallback(async () => {
    if (!image || !currentProjectName || !currentProjectId) return

    try {
      // Convert base64 image to File object
      const imageFile = base64ToFile(image, `${currentProjectName}.png`)
      
      // Prepare ground truth data
      const groundTruth = {
        project_name: currentProjectName,
        annotations: annotations,
        total_annotations: annotations.length,
        created_at: new Date().toISOString(),
      }

      // Upload to backend
      const uploadResult = await uploadImageToBackend(imageFile, groundTruth)

      // Update local storage with MinIO URL
      const projectData: SavedProject = {
        id: currentProjectId,
        name: currentProjectName,
        image: uploadResult.image_url, // Use MinIO URL instead of base64
        annotations,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setSavedProjects((prev) => {
        const existingIndex = prev.findIndex((p) => p.id === currentProjectId)
        if (existingIndex >= 0) {
          // Update existing project
          const updated = [...prev]
          updated[existingIndex] = { ...projectData, createdAt: prev[existingIndex].createdAt }
          return updated
        } else {
          // Add new project
          return [...prev, projectData]
        }
      })

      setHasUnsavedChanges(false)

      toast("Project saved and uploaded", {
        description: `"${currentProjectName}" has been saved and uploaded to server successfully.`,
      })
    } catch (error) {
      console.error('Save project error:', error)
      // Fallback to local save only
      const projectData: SavedProject = {
        id: currentProjectId,
        name: currentProjectName,
        image,
        annotations,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setSavedProjects((prev) => {
        const existingIndex = prev.findIndex((p) => p.id === currentProjectId)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = { ...projectData, createdAt: prev[existingIndex].createdAt }
          return updated
        } else {
          return [...prev, projectData]
        }
      })

      setHasUnsavedChanges(false)

      toast("Project saved locally", {
        description: `"${currentProjectName}" has been saved locally (upload failed).`,
      })
    }
  }, [image, currentProjectName, currentProjectId, annotations, uploadImageToBackend, base64ToFile])

  const loadProject = useCallback((project: SavedProject) => {
    setImage(project.image)
    setCurrentProjectName(project.name)
    setCurrentProjectId(project.id)
    setAnnotations(project.annotations)
    setIsProjectsOpen(false)

    toast("Project loaded", {
      description: `"${project.name}" has been loaded.`,
    })
  }, [])

  const deleteProject = useCallback(
    (projectId: string) => {
      setSavedProjects((prev) => prev.filter((p) => p.id !== projectId))

      // If current project is deleted, clear the workspace
      if (currentProjectId === projectId) {
        setImage(null)
        setCurrentProjectName("")
        setCurrentProjectId(null)
        setAnnotations([])
      }

      toast("Project deleted", {
        description: "Project has been deleted successfully.",
      })
    },
    [currentProjectId],
  )

  const exportAnnotations = useCallback(() => {
    if (!imageRef.current) return

    const exportData = {
      projectName: currentProjectName,
      image: {
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
        src: image,
      },
      annotations: annotations.map((ann) => ({
        id: ann.id,
        label: ann.label,
        bbox: {
          x: ann.x,
          y: ann.y,
          width: ann.width,
          height: ann.height,
        },
      })),
      timestamp: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentProjectName || "ui-annotations"}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast("Annotations exported", {
      description: "JSON file downloaded successfully.",
    })
  }, [image, annotations, currentProjectName])

  const handlePredict = useCallback(async () => {
    if (!image) return

    toast("Prediction started", {
      description: "Calling AI model to predict UI elements...",
    })

    // Simulate API call
    setTimeout(() => {
      const mockPredictions: Annotation[] = [
        {
          id: `pred-${Date.now()}-1`,
          x: 50,
          y: 100,
          width: 120,
          height: 40,
          label: "Button",
        },
        {
          id: `pred-${Date.now()}-2`,
          x: 200,
          y: 150,
          width: 180,
          height: 35,
          label: "Input",
        },
      ]

      setAnnotations((prev) => [...prev, ...mockPredictions])
      toast("Prediction completed", {
        description: `Found ${mockPredictions.length} UI elements.`,
      })
    }, 2000)
  }, [image])

  // Function to handle navigation with unsaved changes
  const handleNavigation = useCallback((href: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(href)
      setIsUnsavedChangesDialogOpen(true)
      return false
    }
    return true
  }, [hasUnsavedChanges])

  // Function to handle save and continue navigation
  const handleSaveAndNavigate = useCallback(async () => {
    if (image && currentProjectName && currentProjectId) {
      try {
        // Convert base64 image to File object
        const imageFile = base64ToFile(image, `${currentProjectName}.png`)
        
        // Prepare ground truth data
        const groundTruth = {
          project_name: currentProjectName,
          annotations: [],
          total_annotations: 0,
          created_at: new Date().toISOString(),
        }

        // Upload to backend
        const uploadResult = await uploadImageToBackend(imageFile, groundTruth)

        // Update local storage with MinIO URL
        const projectData: SavedProject = {
          id: currentProjectId,
          name: currentProjectName,
          image: uploadResult.image_url, // Use MinIO URL instead of base64
          annotations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setSavedProjects((prev) => {
          const existingIndex = prev.findIndex((p) => p.id === currentProjectId)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = { ...projectData, createdAt: prev[existingIndex].createdAt }
            return updated
          } else {
            return [...prev, projectData]
          }
        })

        setHasUnsavedChanges(false)
        setIsUnsavedChangesDialogOpen(false)
        setPendingNavigation(null)
        
        toast("Project auto-saved and uploaded", {
          description: `"${currentProjectName}" has been saved with empty annotations and uploaded to server.`,
        })

        // Navigate after saving
        if (pendingNavigation) {
          window.location.href = pendingNavigation
        }
      } catch (error) {
        console.error('Auto-save error:', error)
        // Fallback to local save only
        const projectData: SavedProject = {
          id: currentProjectId,
          name: currentProjectName,
          image,
          annotations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        setSavedProjects((prev) => {
          const existingIndex = prev.findIndex((p) => p.id === currentProjectId)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = { ...projectData, createdAt: prev[existingIndex].createdAt }
            return updated
          } else {
            return [...prev, projectData]
          }
        })

        setHasUnsavedChanges(false)
        setIsUnsavedChangesDialogOpen(false)
        setPendingNavigation(null)

        toast("Project auto-saved locally", {
          description: `"${currentProjectName}" has been saved locally (upload failed).`,
        })

        // Navigate after saving
        if (pendingNavigation) {
          window.location.href = pendingNavigation
        }
      }
    }
  }, [image, currentProjectName, currentProjectId, uploadImageToBackend, base64ToFile, pendingNavigation])

  // Function to handle discard and continue navigation
  const handleDiscardAndNavigate = useCallback(() => {
    setHasUnsavedChanges(false)
    setIsUnsavedChangesDialogOpen(false)
    
    // Navigate without saving
    if (pendingNavigation) {
      window.location.href = pendingNavigation
    }
  }, [pendingNavigation])

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Thanh điều hướng chung */}
      <AppHeader onNavigation={handleNavigation} />

      {/* Thanh công cụ riêng cho trang Main */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 justify-between">
          {/* Nhóm bên trái: Tên Project (nếu có), Upload, Label Selector, Predict, Save, Export, Trash */}
          <div className="flex items-center gap-2 flex-wrap">
            {" "}
            {/* Sử dụng flex-wrap để các nút xuống dòng nếu không đủ chỗ */}
            {/* {currentProjectName && (
              <p className="text-sm font-semibold text-foreground hidden sm:block mr-2">{currentProjectName}</p>
            )} */}
            {/* Nút New Project thay cho Upload */}
            <Button
              onClick={() => {
                setImage(null)
                setCurrentProjectName("")
                setCurrentProjectId(null)
                setAnnotations([])
                setSelectedAnnotation(null)
                setIsDrawing(false)
                setStartPoint(null)
                setCurrentBox(null)
                setSelectedLabel("Button")
                setIsAnnotationsOpen(false)
                setIsProjectsOpen(false)
                setIsNameDialogOpen(false)
                setProjectName("")
                setPendingImageFile(null)
              }}
              variant="outline"
              size="sm"
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
            {/* Nút New Project cho mobile */}
            <Button onClick={() => {
                setImage(null)
                setCurrentProjectName("")
                setCurrentProjectId(null)
                setAnnotations([])
                setSelectedAnnotation(null)
                setIsDrawing(false)
                setStartPoint(null)
                setCurrentBox(null)
                setSelectedLabel("Button")
                setIsAnnotationsOpen(false)
                setIsProjectsOpen(false)
                setIsNameDialogOpen(false)
                setProjectName("")
                setPendingImageFile(null)
              }} variant="outline" size="sm" className="sm:hidden">
              <Plus className="h-4 w-4" />
            </Button>
            {/* Label Selector */}
            <Select value={selectedLabel} onValueChange={(value: Annotation["label"]) => setSelectedLabel(value)}>
              <SelectTrigger className="w-[120px] h-9 px-3">
                {" "}
                {/* Đã cập nhật kích thước */}
                <SelectValue placeholder="Label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Button">Button</SelectItem>
                <SelectItem value="Input">Input</SelectItem>
                <SelectItem value="Radio">Radio</SelectItem>
                <SelectItem value="Drop">Drop</SelectItem>
              </SelectContent>
            </Select>
            {/* Các nút hành động chính */}
            <Button onClick={handlePredict} disabled={!image} variant="secondary" size="sm">
              <Zap className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Predict</span>
            </Button>
            <Button onClick={saveProject} disabled={!image || !currentProjectName || isUploading} size="sm">
              {isUploading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span className="hidden sm:inline">Uploading...</span>
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Save</span>
                </>
              )}
            </Button>
            {/* Nút Update chỉ hiện khi đang mở project đã có */}
            {currentProjectId && (
              <Button
                onClick={async () => {
                  setIsUpdating(true)
                  try {
                    // Map annotations sang format API
                    const elements = annotations.map(ann => {
                      if (ann.label === "Button") {
                        return {
                          type: "button",
                          text: "Button",
                          position: { x: ann.x, y: ann.y },
                          width: ann.width,
                          height: ann.height
                        }
                      } else if (ann.label === "Input") {
                        return {
                          type: "input",
                          placeholder: "Input",
                          position: { x: ann.x, y: ann.y },
                          width: ann.width,
                          height: ann.height
                        }
                      } else if (ann.label === "Radio") {
                        return {
                          type: "radio",
                          position: { x: ann.x, y: ann.y },
                          width: ann.width,
                          height: ann.height
                        }
                      } else if (ann.label === "Drop") {
                        return {
                          type: "drop",
                          position: { x: ann.x, y: ann.y },
                          width: ann.width,
                          height: ann.height
                        }
                      }
                    })
                    const response = await fetch(`http://localhost:8080/api/v1/images/${currentProjectId}/ground-truth`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ground_truth: { elements } })
                    })
                    if (!response.ok) throw new Error(`Update failed: ${response.status}`)
                    // const data = await response.json()
                    toast("Project updated!", { description: "Annotations have been updated on server." })
                    // Không setAnnotations từ API response, giữ nguyên UI
                  } catch (err) {
                    toast("Update failed", { description: err instanceof Error ? err.message : "Unknown error" })
                  } finally {
                    setIsUpdating(false)
                  }
                }}
                disabled={isUpdating || !image || !currentProjectName}
                variant="secondary"
                size="sm"
              >
                {isUpdating ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Updating...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Update
                  </>
                )}
              </Button>
            )}
            <Button onClick={exportAnnotations} disabled={annotations.length === 0} variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={clearAllAnnotations} disabled={annotations.length === 0} variant="outline" size="sm">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Nhóm bên phải: Badge, Annotations Sheet, Projects Sheet */}
          <div className="flex items-center gap-2">
            {image && (
              <Badge variant="outline" className="hidden sm:flex mr-2">
                {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
              </Badge>
            )}

            {/* Annotations Sheet */}
            <Sheet open={isAnnotationsOpen} onOpenChange={setIsAnnotationsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Menu className="h-4 w-4" />
                  <span className="hidden sm:ml-2 sm:inline">Annotations</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Annotations ({annotations.length})</SheetTitle>
                  <SheetDescription>List of all labeled elements in the image</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  {annotations.map((annotation, index) => (
                    <div key={annotation.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant={LABEL_VARIANTS[annotation.label]}>{annotation.label}</Badge>
                        <span className="text-sm">#{index + 1}</span>
                      </div>
                      <Button
                        onClick={() => deleteAnnotation(annotation.id)}
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {annotations.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No annotations yet. Upload an image and start drawing boxes.
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Projects Panel */}
            <Sheet open={isProjectsOpen} onOpenChange={setIsProjectsOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden sm:ml-2 sm:inline">Projects</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] px-0">
                <DialogTitle className="sr-only">Saved Projects</DialogTitle>
                <div className="px-6 pt-6 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">Saved Projects ({savedProjects.length})</span>
                      <Button 
                        onClick={fetchProjectsFromAPI} 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 ml-1 border border-gray-200 hover:bg-gray-100"
                        disabled={isLoadingProjects}
                        aria-label="Refresh"
                      >
                        {isLoadingProjects ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </Button>
                    </div>
                    {/* Nút X đóng panel giữ nguyên */}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Your saved annotation projects</div>
                </div>
                <div className="mt-2 space-y-4 px-4 pb-6">
                  {isLoadingProjects ? (
                    <div className="p-8 text-center">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <span className="text-sm text-muted-foreground">Loading projects...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {savedProjects.map((project) => (
                        <Card key={project.id} className="p-4 rounded-2xl shadow border border-gray-100 flex flex-row items-center gap-4">
                          <img
                            src={project.image || "/placeholder.svg"}
                            alt={project.name}
                            className="w-14 h-14 object-cover rounded-lg border flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-base truncate max-w-[140px]">{project.name}</span>
                              <div className="flex gap-1">
                                <Button onClick={async () => {
  try {
    const response = await fetch(`http://localhost:8080/api/v1/images/${project.id}`)
    if (!response.ok) throw new Error('Failed to fetch project detail')
    const data = await response.json()
    // Mapping ground_truth.elements về annotation frontend
    const elements = data.ground_truth?.elements || []
    const mappedAnnotations = elements.map((el: any, idx: number) => {
      let label = "Button"
      if (el.type === "button") label = "Button"
      else if (el.type === "input") label = "Input"
      else if (el.type === "radio") label = "Radio"
      else if (el.type === "drop") label = "Drop"
      return {
        id: `${el.type}-${el.position?.x || 0}-${el.position?.y || 0}-${idx}`,
        x: el.position?.x || 0,
        y: el.position?.y || 0,
        width: el.width || 60,
        height: el.height || 30,
        label,
      }
    })
    setImage(data.image_url)
    setCurrentProjectName(data.name)
    setCurrentProjectId(data.id)
    setAnnotations(mappedAnnotations)
    toast("Project loaded", { description: `Project '${data.name}' loaded from server.` })
    setIsProjectsOpen(false)
  } catch (err) {
    toast("Failed to load project", { description: err instanceof Error ? err.message : "Unknown error" })
  }
}} variant="outline" size="icon" className="h-8 w-8">
  <Eye className="h-4 w-4" />
</Button>
                                <Button onClick={async () => {
  try {
    const response = await fetch(`http://localhost:8080/api/v1/images/${project.id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete project')
    toast('Project deleted', { description: 'Project has been deleted successfully.' })
    await fetchProjectsFromAPI()
  } catch (err) {
    toast('Delete failed', { description: err instanceof Error ? err.message : 'Unknown error' })
  }
}} variant="outline" size="icon" className="h-8 w-8">
  <Trash2 className="h-4 w-4" />
</Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">{project.annotations.length} annotation{project.annotations.length !== 1 ? "s" : ""}</span>
                              <span className="text-xs text-muted-foreground">{new Date(project.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {savedProjects.length === 0 && (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No saved projects yet. Create and save your first annotation project.
                        </div>
                      )}
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Project Name Dialog */}
      <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name Your Project</DialogTitle>
            <DialogDescription>Give your annotation project a name to help you identify it later.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="project-name" className="text-right">
                Name
              </Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="col-span-3"
                placeholder="Enter project name..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleProjectNameSubmit()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsNameDialogOpen(false)
                setProjectName("")
                setPendingImageFile(null)
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={handleProjectNameSubmit} disabled={!projectName.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <Dialog open={isUnsavedChangesDialogOpen} onOpenChange={setIsUnsavedChangesDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-yellow-100 text-yellow-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              Unsaved Changes
            </DialogTitle>
            <DialogDescription className="text-left">
              You haven't labeled anything yet. Do you want to save this project before leaving? If you save it, the project will be saved with empty annotations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg my-4">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentProjectName}</p>
              <p className="text-xs text-muted-foreground">0 annotations</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleDiscardAndNavigate}
              className="w-full sm:w-auto"
            >
              Discard & Leave
            </Button>
                            <Button 
                  onClick={handleSaveAndNavigate}
                  disabled={isUploading}
                  className="w-full sm:w-auto"
                >
                  {isUploading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Uploading...
                    </>
                  ) : (
                    "Save & Continue"
                  )}
                </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

        {!image ? (
          <Card className="h-full m-4">
            <CardContent className="flex h-full items-center justify-center">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Upload an image</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Click the upload button or drag and drop an image to start annotating
                </p>
                <Button onClick={() => fileInputRef.current?.click()} className="mt-4">
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="h-full overflow-auto p-4">
            <div className="flex justify-center items-start min-h-full">
              <div
                ref={containerRef}
                className="relative cursor-crosshair max-w-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ display: "inline-block" }}
              >
                <img
                  ref={imageRef}
                  src={image || "/placeholder.svg"}
                  alt="Annotation target"
                  className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto block object-contain"
                  draggable={false}
                />

                {/* Existing annotations */}
                {annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    className={`absolute border-2 ${LABEL_COLORS[annotation.label]} pointer-events-none`}
                    style={{
                      left: annotation.x,
                      top: annotation.y,
                      width: annotation.width,
                      height: annotation.height,
                      background: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 4px,
                      ${
                        annotation.label === "Button"
                          ? "rgba(59, 130, 246, 0.1)"
                          : annotation.label === "Input"
                            ? "rgba(34, 197, 94, 0.1)"
                            : annotation.label === "Radio"
                              ? "rgba(168, 85, 247, 0.1)"
                              : "rgba(249, 115, 22, 0.1)"
                      } 4px,
                      ${
                        annotation.label === "Button"
                          ? "rgba(59, 130, 246, 0.1)"
                          : annotation.label === "Input"
                            ? "rgba(34, 197, 94, 0.1)"
                            : "rgba(168, 85, 247, 0.1)"
                      } 8px
                    )`,
                    }}
                  >
                    <div
                      className={`absolute -top-6 left-0 px-2 py-1 text-xs text-white rounded ${LABEL_BG_COLORS[annotation.label]}`}
                    >
                      {annotation.label}
                    </div>
                  </div>
                ))}

                {/* Current drawing box */}
                {currentBox && (
                  <div
                    className={`absolute border-2 border-dashed ${LABEL_COLORS[selectedLabel]} pointer-events-none`}
                    style={{
                      left: currentBox.x,
                      top: currentBox.y,
                      width: currentBox.width,
                      height: currentBox.height,
                      background: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 4px,
                      ${
                        selectedLabel === "Button"
                          ? "rgba(59, 130, 246, 0.15)"
                          : selectedLabel === "Input"
                            ? "rgba(34, 197, 94, 0.15)"
                            : selectedLabel === "Radio"
                              ? "rgba(168, 85, 247, 0.15)"
                              : "rgba(249, 115, 22, 0.15)"
                      } 4px,
                      ${
                        selectedLabel === "Button"
                          ? "rgba(59, 130, 246, 0.15)"
                          : selectedLabel === "Input"
                            ? "rgba(34, 197, 94, 0.15)"
                            : "rgba(168, 85, 247, 0.15)"
                      } 8px
                    )`,
                    }}
                  >
                    <div
                      className={`absolute -top-6 left-0 px-2 py-1 text-xs text-white rounded ${LABEL_BG_COLORS[selectedLabel]}`}
                    >
                      {selectedLabel}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
