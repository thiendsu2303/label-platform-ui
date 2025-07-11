"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Upload, Save, Trash2, Zap, Menu, FolderOpen, Eye } from "lucide-react"
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
  const [projectName, setProjectName] = useState("")
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [pendingImageFile, setPendingImageFile] = useState<string | null>(null)

  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load saved projects from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("ui-annotation-projects")
    if (saved) {
      try {
        setSavedProjects(JSON.parse(saved))
      } catch (error) {
        console.error("Error loading saved projects:", error)
      }
    }
  }, [])

  // Save projects to localStorage whenever savedProjects changes
  useEffect(() => {
    localStorage.setItem("ui-annotation-projects", JSON.stringify(savedProjects))
  }, [savedProjects])

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

  const saveProject = useCallback(() => {
    if (!image || !currentProjectName || !currentProjectId) return

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
        // Update existing project
        const updated = [...prev]
        updated[existingIndex] = { ...projectData, createdAt: prev[existingIndex].createdAt }
        return updated
      } else {
        // Add new project
        return [...prev, projectData]
      }
    })

    toast("Project saved", {
      description: `"${currentProjectName}" has been saved successfully.`,
    })
  }, [image, currentProjectName, currentProjectId, annotations])

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

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Thanh điều hướng chung */}
      <AppHeader />

      {/* Thanh công cụ riêng cho trang Main */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 justify-between">
          {/* Nhóm bên trái: Tên Project (nếu có), Upload, Label Selector, Predict, Save, Export, Trash */}
          <div className="flex items-center gap-2 flex-wrap">
            {" "}
            {/* Sử dụng flex-wrap để các nút xuống dòng nếu không đủ chỗ */}
            {currentProjectName && (
              <p className="text-sm font-semibold text-foreground hidden sm:block mr-2">{currentProjectName}</p>
            )}
            {/* Nút Upload */}
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
              className="hidden sm:flex"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            {/* Nút Upload cho mobile */}
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="sm:hidden">
              <Upload className="h-4 w-4" />
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
            <Button onClick={saveProject} disabled={!image || !currentProjectName} size="sm">
              <Save className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Save</span>
            </Button>
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
              <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                  <SheetTitle>Saved Projects ({savedProjects.length})</SheetTitle>
                  <SheetDescription>Your saved annotation projects</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-3">
                  {savedProjects.map((project) => (
                    <Card key={project.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={project.image || "/placeholder.svg"}
                          alt={project.name}
                          className="w-16 h-16 object-cover rounded border"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{project.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {project.annotations.length} annotation{project.annotations.length !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(project.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button onClick={() => loadProject(project)} variant="outline" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button onClick={() => deleteProject(project.id)} variant="outline" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {savedProjects.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No saved projects yet. Create and save your first annotation project.
                    </div>
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
                            : selectedLabel === "Radio"
                              ? "rgba(168, 85, 247, 0.15)"
                              : "rgba(249, 115, 22, 0.15)"
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
