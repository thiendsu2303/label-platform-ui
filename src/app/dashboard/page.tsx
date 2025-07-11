"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts"
import { AppHeader } from "@/components/header"

// Re-using interfaces from app/main/page.tsx
interface Annotation {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: "Button" | "Input" | "Radio" | "Drop"
}

interface SavedProject {
  id: string
  name: string
  image: string
  annotations: Annotation[]
  createdAt: string
  updatedAt: string
}

interface Metrics {
  total_ground_truth: number
  true_positives: number
  false_positives: number
  false_negatives: number
  precision: number
  recall: number
  f1_score: number
}

interface EvaluationResults {
  [tag: string]: Metrics
}

// Helper function for IoU (Intersection over Union)
function calculateIoU(
  box1: { x: number; y: number; width: number; height: number },
  box2: { x: number; y: number; width: number; height: number },
): number {
  const x_overlap = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x))
  const y_overlap = Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y))

  const intersection_area = x_overlap * y_overlap
  const box1_area = box1.width * box1.height
  const box2_area = box2.width * box2.height
  const union_area = box1_area + box2_area - intersection_area

  return union_area === 0 ? 0 : intersection_area / union_area
}

// Function to evaluate a single image's annotations
function evaluateSingleImage(
  groundTruthAnnotations: Annotation[],
  predictionAnnotations: Annotation[],
  iouThreshold = 0.5,
): EvaluationResults {
  const labels = ["Button", "Input", "Radio", "Drop"] as const
  const metrics: EvaluationResults = {}

  labels.forEach((label) => {
    metrics[label] = {
      total_ground_truth: 0,
      true_positives: 0,
      false_positives: 0,
      false_negatives: 0,
      precision: 0,
      recall: 0,
      f1_score: 0,
    }
  })

  const matchedPredIndices = new Set<number>()

  for (const gtBox of groundTruthAnnotations) {
    metrics[gtBox.label].total_ground_truth++
    let bestIoU = 0
    let bestPredIndex = -1

    for (let i = 0; i < predictionAnnotations.length; i++) {
      const predBox = predictionAnnotations[i]
      if (predBox.label === gtBox.label && !matchedPredIndices.has(i)) {
        const iou = calculateIoU(gtBox, predBox)
        if (iou > bestIoU) {
          bestIoU = iou
          bestPredIndex = i
        }
      }
    }

    if (bestIoU >= iouThreshold) {
      metrics[gtBox.label].true_positives++
      matchedPredIndices.add(bestPredIndex)
    } else {
      metrics[gtBox.label].false_negatives++
    }
  }

  for (let i = 0; i < predictionAnnotations.length; i++) {
    if (!matchedPredIndices.has(i)) {
      const predBox = predictionAnnotations[i]
      metrics[predBox.label].false_positives++
    }
  }

  labels.forEach((label) => {
    const tp = metrics[label].true_positives
    const fp = metrics[label].false_positives
    const fn = metrics[label].false_negatives

    const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
    const f1_score = precision + recall === 0 ? 0 : (2 * (precision * recall)) / (precision + recall)

    metrics[label].precision = precision
    metrics[label].recall = recall
    metrics[label].f1_score = f1_score
  })

  return metrics
}

// Mock LLM prediction generation (for demo purposes)
function generateMockLLMPredictions(groundTruthAnnotations: Annotation[]): Annotation[] {
  const mockPredictions: Annotation[] = []
  groundTruthAnnotations.forEach((gt) => {
    // Simulate some correct predictions (slightly offset)
    if (Math.random() < 0.85) {
      // 85% chance of a "correct" prediction
      mockPredictions.push({
        ...gt,
        id: `pred-${gt.id}-${Math.random().toString(36).substring(7)}`,
        x: gt.x + Math.random() * 10 - 5, // small random offset
        y: gt.y + Math.random() * 10 - 5,
        width: gt.width + Math.random() * 5 - 2.5,
        height: gt.height + Math.random() * 5 - 2.5,
      })
    }
    // Simulate some false positives (random new boxes)
    if (Math.random() < 0.1) {
      // 10% chance of a false positive
      const randomLabel = ["Button", "Input", "Radio", "Drop"][Math.floor(Math.random() * 4)] as Annotation["label"]
      mockPredictions.push({
        id: `fp-${Math.random().toString(36).substring(7)}`,
        x: Math.random() * 500,
        y: Math.random() * 400,
        width: Math.random() * 100 + 30,
        height: Math.random() * 50 + 20,
        label: randomLabel,
      })
    }
  })
  return mockPredictions
}

export default function DashboardPage() {
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [selectedProjectResults, setSelectedProjectResults] = useState<{
    project: SavedProject
    results: EvaluationResults
  } | null>(null)

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

  const handleEvaluateProject = useCallback((project: SavedProject) => {
    toast("Evaluating Project", {
      description: `Calculating metrics for "${project.name}"...`,
      duration: 2000,
    })

    // Simulate LLM predictions for this specific project
    const mockLLMPredictions = generateMockLLMPredictions(project.annotations)

    // Run evaluation
    const results = evaluateSingleImage(project.annotations, mockLLMPredictions)

    setSelectedProjectResults({ project, results })
    toast("Evaluation Complete", {
      description: `Results for "${project.name}" are ready.`,
      duration: 2000,
    })
  }, [])

  const handleDeleteProject = useCallback(
    (projectId: string) => {
      setSavedProjects((prev) => {
        const updatedProjects = prev.filter((p) => p.id !== projectId)
        localStorage.setItem("ui-annotation-projects", JSON.stringify(updatedProjects))
        return updatedProjects
      })
      if (selectedProjectResults?.project.id === projectId) {
        setSelectedProjectResults(null)
      }
      toast("Project Deleted", {
        description: "Project removed successfully.",
      })
    },
    [selectedProjectResults],
  )

  const chartData = selectedProjectResults
    ? Object.entries(selectedProjectResults.results).map(([label, metrics]) => ({
        name: label,
        Precision: metrics.precision,
        Recall: metrics.recall,
        F1: metrics.f1_score,
      }))
    : []

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 dark:bg-gray-950">
      <AppHeader />
      {/* Đây là header mới */}
      <div className="flex-1 flex">
        {/* Phần nội dung còn lại */}
        {/* Left Panel: Project List */}
        <div className="w-full md:w-1/3 lg:w-1/4 border-r bg-background dark:bg-gray-900 p-4 overflow-y-auto shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Your Projects</h2>
          {savedProjects.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4 text-center border border-dashed rounded-lg">
              No saved projects yet. Go to <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/main</code>{" "}
              to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {savedProjects.map((project) => (
                <Card
                  key={project.id}
                  className={`p-3 cursor-pointer transition-all duration-200 ease-in-out hover:bg-muted/50 dark:hover:bg-gray-800 ${
                    selectedProjectResults?.project.id === project.id
                      ? "border-primary ring-2 ring-primary shadow-lg"
                      : "border-transparent"
                  }`}
                  onClick={() => handleEvaluateProject(project)}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={project.image || "/placeholder.svg"}
                      alt={project.name}
                      className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-700"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate text-gray-900 dark:text-gray-50">{project.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {project.annotations.length} annotation{project.annotations.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project.id)
                      }}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel: Evaluation Report */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-100 dark:bg-gray-950">
          {!selectedProjectResults ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <BarChart2 className="h-20 w-20 mb-6 text-gray-400 dark:text-gray-600" />
              <h3 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">
                Select a Project to View Evaluation
              </h3>
              <p className="text-base mt-2 max-w-md">
                Click on any project from the left panel to see its LLM prediction performance metrics and detailed
                reports.
              </p>
            </div>
          ) : (
            <div className="space-y-8 max-w-4xl mx-auto">
              <h2 className="text-4xl font-extrabold text-center text-gray-900 dark:text-gray-50 mb-8">
                Evaluation Report for "{selectedProjectResults.project.name}"
              </h2>

              {/* Summary Metrics */}
              <Card className="shadow-lg border-t-4 border-primary-foreground dark:border-primary-foreground/50">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    Overall Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div className="p-4 bg-muted/30 dark:bg-muted/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Average Precision</p>
                      <p className="text-4xl font-extrabold text-[hsl(var(--chart-precision))]">
                        {(chartData.reduce((sum, d) => sum + d.Precision, 0) / chartData.length || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/30 dark:bg-muted/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Average Recall</p>
                      <p className="text-4xl font-extrabold text-[hsl(var(--chart-recall))]">
                        {(chartData.reduce((sum, d) => sum + d.Recall, 0) / chartData.length || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/30 dark:bg-muted/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Average F1-score</p>
                      <p className="text-4xl font-extrabold text-[hsl(var(--chart-f1))]">
                        {(chartData.reduce((sum, d) => sum + d.F1, 0) / chartData.length || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Charts */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    Metrics by Label
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" className="text-sm text-muted-foreground" />
                      <YAxis domain={[0, 1]} className="text-sm text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Legend wrapperStyle={{ paddingTop: "10px" }} />
                      <Bar
                        dataKey="Precision"
                        fill="hsl(var(--chart-precision))"
                        name="Precision"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar dataKey="Recall" fill="hsl(var(--chart-recall))" name="Recall" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="F1" fill="hsl(var(--chart-f1))" name="F1-score" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed Table */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    Detailed Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            Label
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            GT Boxes
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            TP
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            FP
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            FN
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            Precision
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            Recall
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                            F1-score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {Object.entries(selectedProjectResults.results).map(([label, metrics]) => (
                          <tr key={label} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-50">
                              {label}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.total_ground_truth}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.true_positives}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.false_positives}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.false_negatives}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.precision.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.recall.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                              {metrics.f1_score.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
