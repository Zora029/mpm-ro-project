"use client"

import React from "react"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Plus, ChevronDown, ChevronUp, GripVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import MPMGraph from "@/components/mpm-graph"
import ResultsTable from "@/components/results-table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import data from "@/mock"

interface Task {
  id: string
  name: string
  duration: number
  predecessors: string[]
}

interface CalculatedTask extends Task {
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
}

export default function MPMTool() {
  const [tasks, setTasks] = useState<Task[]>(data.tasks2 || [])

  const [calculatedTasks, setCalculatedTasks] = useState<CalculatedTask[]>([])
  const [projectDuration, setProjectDuration] = useState(0)
  const [criticalPath, setCriticalPath] = useState<string[]>([])

  const [stepByStepMode, setStepByStepMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [calculationSteps, setCalculationSteps] = useState<any[]>([])

  // Panel states
  const [isTasksPanelOpen, setIsTasksPanelOpen] = useState(true)
  const [isAnalysisPanelOpen, setIsAnalysisPanelOpen] = useState(true)
  const [isTableOpen, setIsTableOpen] = useState(false)

  // Resize functionality
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = e.clientX
      if (newWidth >= 250 && newWidth <= 600) {
        setSidebarWidth(newWidth)
      }
    },
    [isResizing],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  // Add event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  const addTask = () => {
    const newId = String.fromCharCode(65 + tasks.length)
    setTasks([...tasks, { id: newId, name: newId, duration: 1, predecessors: [] }])
  }

  const removeTask = (id: string) => {
    const newTasks = tasks.filter((task) => task.id !== id)
    const updatedTasks = newTasks.map((task) => ({
      ...task,
      predecessors: task.predecessors.filter((pred) => pred !== id),
    }))
    setTasks(updatedTasks)
    setCalculatedTasks([])
    setCriticalPath([])
    setProjectDuration(0)
  }

  const updateTask = (id: string, field: keyof Task, value: any) => {
    setTasks(tasks.map((task) => (task.id === id ? { ...task, [field]: value } : task)))
    setCalculatedTasks([])
    setCriticalPath([])
    setProjectDuration(0)
  }

  const addPredecessor = (taskId: string, predecessor: string) => {
    if (predecessor && !tasks.find((t) => t.id === taskId)?.predecessors.includes(predecessor)) {
      setTasks(
        tasks.map((task) =>
          task.id === taskId ? { ...task, predecessors: [...task.predecessors, predecessor] } : task,
        ),
      )
      setCalculatedTasks([])
      setCriticalPath([])
      setProjectDuration(0)
    }
  }

  const removePredecessor = (taskId: string, predecessor: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === taskId ? { ...task, predecessors: task.predecessors.filter((p) => p !== predecessor) } : task,
      ),
    )
    setCalculatedTasks([])
    setCriticalPath([])
    setProjectDuration(0)
  }

  const validateTasks = () => {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (taskId: string): boolean => {
      if (recursionStack.has(taskId)) return true
      if (visited.has(taskId)) return false

      visited.add(taskId)
      recursionStack.add(taskId)

      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        for (const pred of task.predecessors) {
          if (hasCycle(pred)) return true
        }
      }

      recursionStack.delete(taskId)
      return false
    }

    for (const task of tasks) {
      if (hasCycle(task.id)) {
        alert(`Circular dependency detected involving task ${task.id}. Please fix dependencies.`)
        return false
      }
    }

    for (const task of tasks) {
      for (const pred of task.predecessors) {
        if (!tasks.find((t) => t.id === pred)) {
          alert(`Task ${task.id} references non-existent predecessor ${pred}`)
          return false
        }
      }
    }

    return true
  }

  const calculateMPM = (stepMode = false) => {
    if (tasks.length === 0) {
      alert("Please add at least one task")
      return
    }

    if (!validateTasks()) return

    try {
      const steps: any[] = []
      const calculated: CalculatedTask[] = tasks.map((task) => ({
        ...task,
        earlyStart: 0,
        earlyFinish: 0,
        lateStart: 0,
        lateFinish: 0,
        totalFloat: 0,
        isCritical: false,
      }))

      steps.push({
        step: 1,
        title: "Initialize Tasks",
        description: "Set all early start, early finish, late start, and late finish values to 0",
        tasks: JSON.parse(JSON.stringify(calculated)),
        highlight: [],
      })

      const processedTasks = new Set<string>()
      let iterations = 0
      const maxIterations = tasks.length * 2
      let stepNumber = 2

      while (processedTasks.size < calculated.length && iterations < maxIterations) {
        let progressMade = false

        for (const task of calculated) {
          if (processedTasks.has(task.id)) continue

          const allPredecessorsProcessed = task.predecessors.every((pred) => processedTasks.has(pred))

          if (allPredecessorsProcessed) {
            if (task.predecessors.length === 0) {
              task.earlyStart = 0
              steps.push({
                step: stepNumber++,
                title: `Forward Pass - Task ${task.id}`,
                description: `Task ${task.id} has no predecessors, so Early Start = 0`,
                tasks: JSON.parse(JSON.stringify(calculated)),
                highlight: [task.id],
              })
            } else {
              const maxEF = Math.max(
                ...task.predecessors.map((predId) => {
                  const pred = calculated.find((t) => t.id === predId)!
                  return pred.earlyFinish
                }),
              )
              task.earlyStart = maxEF
              steps.push({
                step: stepNumber++,
                title: `Forward Pass - Task ${task.id}`,
                description: `Early Start = max(Early Finish of predecessors: ${task.predecessors.join(", ")}) = ${maxEF}`,
                tasks: JSON.parse(JSON.stringify(calculated)),
                highlight: [task.id, ...task.predecessors],
              })
            }

            task.earlyFinish = task.earlyStart + task.duration
            steps.push({
              step: stepNumber++,
              title: `Forward Pass - Task ${task.id} Finish`,
              description: `Early Finish = Early Start + Duration = ${task.earlyStart} + ${task.duration} = ${task.earlyFinish}`,
              tasks: JSON.parse(JSON.stringify(calculated)),
              highlight: [task.id],
            })

            processedTasks.add(task.id)
            progressMade = true
          }
        }

        if (!progressMade) {
          alert("Unable to calculate forward pass. Check for circular dependencies.")
          return
        }
        iterations++
      }

      const maxEarlyFinish = Math.max(...calculated.map((task) => task.earlyFinish))
      steps.push({
        step: stepNumber++,
        title: "Project Duration",
        description: `Project Duration = max(Early Finish of all tasks) = ${maxEarlyFinish}`,
        tasks: JSON.parse(JSON.stringify(calculated)),
        highlight: calculated.filter((t) => t.earlyFinish === maxEarlyFinish).map((t) => t.id),
      })

      const processedBackward = new Set<string>()
      iterations = 0

      calculated.forEach((task) => {
        const hasSuccessors = calculated.some((t) => t.predecessors.includes(task.id))
        if (!hasSuccessors) {
          task.lateFinish = maxEarlyFinish
          task.lateStart = task.lateFinish - task.duration
          processedBackward.add(task.id)
          steps.push({
            step: stepNumber++,
            title: `Backward Pass - Task ${task.id}`,
            description: `Task ${task.id} is a final task. Late Finish = Project Duration = ${task.lateFinish}, Late Start = ${task.lateFinish} - ${task.duration} = ${task.lateStart}`,
            tasks: JSON.parse(JSON.stringify(calculated)),
            highlight: [task.id],
          })
        }
      })

      while (processedBackward.size < calculated.length && iterations < maxIterations) {
        let progressMade = false

        for (const task of calculated) {
          if (processedBackward.has(task.id)) continue

          const successors = calculated.filter((t) => t.predecessors.includes(task.id))
          const allSuccessorsProcessed = successors.every((succ) => processedBackward.has(succ.id))

          if (allSuccessorsProcessed && successors.length > 0) {
            const minLS = Math.min(...successors.map((succ) => succ.lateStart))
            task.lateFinish = minLS
            task.lateStart = task.lateFinish - task.duration
            processedBackward.add(task.id)
            progressMade = true

            steps.push({
              step: stepNumber++,
              title: `Backward Pass - Task ${task.id}`,
              description: `Late Finish = min(Late Start of successors: ${successors.map((s) => s.id).join(", ")}) = ${minLS}, Late Start = ${task.lateFinish} - ${task.duration} = ${task.lateStart}`,
              tasks: JSON.parse(JSON.stringify(calculated)),
              highlight: [task.id, ...successors.map((s) => s.id)],
            })
          }
        }

        if (!progressMade && processedBackward.size < calculated.length) {
          for (const task of calculated) {
            if (!processedBackward.has(task.id)) {
              task.lateFinish = maxEarlyFinish
              task.lateStart = task.lateFinish - task.duration
              processedBackward.add(task.id)
            }
          }
          break
        }
        iterations++
      }

      calculated.forEach((task) => {
        task.totalFloat = task.lateStart - task.earlyStart
        task.isCritical = task.totalFloat === 0
      })

      steps.push({
        step: stepNumber++,
        title: "Calculate Total Float",
        description: "Total Float = Late Start - Early Start. Tasks with 0 float are on the critical path.",
        tasks: JSON.parse(JSON.stringify(calculated)),
        highlight: calculated.filter((t) => t.isCritical).map((t) => t.id),
      })

      const critical = calculated.filter((task) => task.isCritical).map((task) => task.id)

      if (stepMode) {
        setStepByStepMode(true)
        setCalculationSteps(steps)
        setCurrentStep(0)
        setCalculatedTasks(steps[0].tasks)
        setCriticalPath([])
        setProjectDuration(0)
      } else {
        setStepByStepMode(false)
        setCalculatedTasks(calculated)
        setCriticalPath(critical)
        setProjectDuration(maxEarlyFinish)
      }
    } catch (error) {
      console.error("Error calculating MPM:", error)
      alert("An error occurred during calculation. Please check your task data.")
    }
  }

  const nextStep = () => {
    if (currentStep < calculationSteps.length - 1) {
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      const step = calculationSteps[newStep]
      setCalculatedTasks(step.tasks)

      if (newStep === calculationSteps.length - 1) {
        const critical = step.tasks
          .filter((task: CalculatedTask) => task.isCritical)
          .map((task: CalculatedTask) => task.id)
        setCriticalPath(critical)
        const maxEF = Math.max(...step.tasks.map((task: CalculatedTask) => task.earlyFinish))
        setProjectDuration(maxEF)
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1
      setCurrentStep(newStep)
      const step = calculationSteps[newStep]
      setCalculatedTasks(step.tasks)
      setCriticalPath([])
      setProjectDuration(0)
    }
  }

  const exitStepMode = () => {
    setStepByStepMode(false)
    if (calculationSteps.length > 0) {
      const finalStep = calculationSteps[calculationSteps.length - 1]
      setCalculatedTasks(finalStep.tasks)
      const critical = finalStep.tasks
        .filter((task: CalculatedTask) => task.isCritical)
        .map((task: CalculatedTask) => task.id)
      setCriticalPath(critical)
      const maxEF = Math.max(...finalStep.tasks.map((task: CalculatedTask) => task.earlyFinish))
      setProjectDuration(maxEF)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MPM Project Management Tool</h1>
            <p className="text-sm text-muted-foreground">Metra Potential Method - Critical Path Analysis</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={() => calculateMPM(false)} size="sm">
              Calculate MPM
            </Button>
            <Button onClick={() => calculateMPM(true)} variant="secondary" size="sm">
              Step by Step
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Resizable */}
        <div
          ref={sidebarRef}
          className="bg-white border-r flex flex-col overflow-hidden relative"
          style={{ width: sidebarWidth }}
        >
          {/* Tasks Panel */}
          <Collapsible
            open={isTasksPanelOpen}
            onOpenChange={setIsTasksPanelOpen}
            className="flex flex-col flex-1 min-h-0"
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 border-b hover:bg-gray-50 cursor-pointer flex-shrink-0">
                <h3 className="font-semibold">Project Tasks ({tasks.length})</h3>
                {isTasksPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex-1 min-h-0">
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs font-mono">
                          {task.id}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTask(task.id)}
                          disabled={tasks.length <= 1}
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-600">Name</Label>
                          <Input
                            value={task.name}
                            onChange={(e) => updateTask(task.id, "name", e.target.value)}
                            className="h-7 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">Duration</Label>
                          <Input
                            type="number"
                            min="1"
                            value={task.duration}
                            onChange={(e) => updateTask(task.id, "duration", Number.parseInt(e.target.value) || 1)}
                            className="h-7 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-gray-600">Predecessors</Label>
                        <div className="flex flex-wrap gap-1 mt-1 mb-2">
                          {task.predecessors.map((pred) => (
                            <Badge
                              key={pred}
                              variant="secondary"
                              className="cursor-pointer text-xs h-5"
                              onClick={() => removePredecessor(task.id, pred)}
                            >
                              {pred} ×
                            </Badge>
                          ))}
                        </div>
                        <select
                          className="w-full p-1 border rounded text-xs h-7"
                          onChange={(e) => {
                            if (e.target.value) {
                              addPredecessor(task.id, e.target.value)
                              e.target.value = ""
                            }
                          }}
                        >
                          <option value="">Add predecessor...</option>
                          {tasks
                            .filter((t) => t.id !== task.id && !task.predecessors.includes(t.id))
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.id} - {t.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t bg-white flex-shrink-0">
                  <Button onClick={addTask} variant="outline" className="w-full h-8 text-sm bg-transparent">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Task
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Analysis Panel */}
          <Collapsible open={isAnalysisPanelOpen} onOpenChange={setIsAnalysisPanelOpen} className="flex-shrink-0">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 border-b hover:bg-gray-50 cursor-pointer">
                <h3 className="font-semibold">Project Analysis</h3>
                {isAnalysisPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4">
                {calculatedTasks.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{projectDuration}</div>
                        <div className="text-xs text-blue-600">Duration</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-xl font-bold text-red-600">{criticalPath.length}</div>
                        <div className="text-xs text-red-600">Critical</div>
                      </div>
                    </div>

                    <div>
                      <Label className="font-semibold text-sm">Critical Path:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {criticalPath.map((taskId) => (
                          <Badge key={taskId} variant="destructive" className="text-xs">
                            {taskId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-6 text-sm">Calculate MPM to see analysis</div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Step-by-Step Panel */}
          {stepByStepMode && (
            <div className="border-t bg-blue-50 p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">Step {calculationSteps[currentStep]?.step}</h4>
                <Button onClick={exitStepMode} variant="ghost" size="sm" className="h-6 text-xs">
                  Exit
                </Button>
              </div>
              <h5 className="font-medium text-sm mb-1">{calculationSteps[currentStep]?.title}</h5>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">{calculationSteps[currentStep]?.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex space-x-1">
                  <Button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    size="sm"
                    variant="outline"
                    className="h-7 bg-transparent"
                  >
                    Prev
                  </Button>
                  <Button
                    onClick={nextStep}
                    disabled={currentStep === calculationSteps.length - 1}
                    size="sm"
                    className="h-7"
                  >
                    Next
                  </Button>
                </div>
                <span className="text-xs text-gray-500">
                  {currentStep + 1}/{calculationSteps.length}
                </span>
              </div>
            </div>
          )}

          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:w-1.5 transition-all duration-150 bg-gray-300"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* MPM Graph */}
          <div className="flex-1 p-4">
            {calculatedTasks.length > 0 ? (
              <MPMGraph
                tasks={calculatedTasks}
                criticalPath={criticalPath}
                projectDuration={projectDuration}
                highlightedNodes={
                  stepByStepMode && calculationSteps[currentStep] ? calculationSteps[currentStep].highlight : []
                }
              />
            ) : (
              <Card className="h-full">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="text-6xl mb-4">📊</div>
                    <div className="text-lg font-medium mb-2">MPM Network Diagram</div>
                    <div className="text-sm">Click "Calculate MPM" to generate the network diagram</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Bottom Table - Collapsible */}
          {calculatedTasks.length > 0 && (
            <div className="flex-shrink-0 border-t bg-white">
              <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full flex items-center justify-center p-3 hover:bg-gray-50">
                    <span className="text-sm font-medium mr-2">Detailed Task Analysis</span>
                    {isTableOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t">
                  <div className="p-4 max-h-[30rem] h-full overflow-y-auto bg-white">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold">Detailed Task Analysis</h3>
                      <p className="text-sm text-muted-foreground">Complete breakdown of all task calculations</p>
                    </div>
                    <ResultsTable tasks={calculatedTasks} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
