"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Hand, MousePointer, ZoomIn, ZoomOut, Maximize, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface CalculatedTask {
  id: string
  name: string
  duration: number
  predecessors: string[]
  earlyStart: number
  earlyFinish: number
  lateStart: number
  lateFinish: number
  totalFloat: number
  isCritical: boolean
}

interface MPMGraphProps {
  tasks: CalculatedTask[]
  criticalPath: string[]
  projectDuration: number
  highlightedNodes?: string[]
}

type Tool = "select" | "hand" | "move"

interface Transform {
  x: number
  y: number
  scale: number
}

interface NodePosition {
  x: number
  y: number
}

export default function MPMGraph({ tasks, criticalPath, projectDuration, highlightedNodes = [] }: MPMGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [tool, setTool] = useState<Tool>("select")
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 })
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [nodePositions, setNodePositions] = useState<{ [key: string]: NodePosition }>({})
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const nodeWidth = 120
  const nodeHeight = 80

  // Calculate initial node positions
  const calculateNodePositions = useCallback(() => {
    if (tasks.length === 0) return {}

    const positions: { [key: string]: NodePosition } = {}
    const levelHeight = 120
    const nodeSpacing = 150

    // Group tasks by level (based on dependencies)
    const levels: string[][] = []
    const processedTasks = new Set<string>()

    // Add start node
    positions["START"] = { x: 100, y: 300 }

    // Level 0: tasks with no predecessors
    let currentLevel = tasks.filter((task) => task.predecessors.length === 0).map((task) => task.id)
    levels.push(currentLevel)

    while (currentLevel.length > 0) {
      currentLevel.forEach((taskId) => processedTasks.add(taskId))

      const nextLevel = tasks
        .filter((task) => !processedTasks.has(task.id) && task.predecessors.every((pred) => processedTasks.has(pred)))
        .map((task) => task.id)

      if (nextLevel.length > 0) {
        levels.push(nextLevel)
        currentLevel = nextLevel
      } else {
        break
      }
    }

    // Position nodes
    levels.forEach((level, levelIndex) => {
      const startY = 300 - ((level.length - 1) * nodeSpacing) / 2
      level.forEach((taskId, taskIndex) => {
        positions[taskId] = {
          x: 300 + levelIndex * 200,
          y: startY + taskIndex * nodeSpacing,
        }
      })
    })

    // Add end node
    positions["END"] = { x: 300 + levels.length * 200, y: 300 }

    return positions
  }, [tasks])

  // Initialize node positions
  useEffect(() => {
    const positions = calculateNodePositions()
    setNodePositions(positions)
  }, [calculateNodePositions])

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }

      return {
        x: (screenX - rect.left - transform.x) / transform.scale,
        y: (screenY - rect.top - transform.y) / transform.scale,
      }
    },
    [transform],
  )

  // Check if point is inside a node
  const getNodeAtPoint = useCallback(
    (x: number, y: number) => {
      for (const [nodeId, pos] of Object.entries(nodePositions)) {
        if (
          x >= pos.x - nodeWidth / 2 &&
          x <= pos.x + nodeWidth / 2 &&
          y >= pos.y - nodeHeight / 2 &&
          y <= pos.y + nodeHeight / 2
        ) {
          return nodeId
        }
      }
      return null
    },
    [nodePositions],
  )

  // Zoom functions
  const zoomIn = () => {
    setTransform((prev) => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))
  }

  const zoomOut = () => {
    setTransform((prev) => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }))
  }

  const fitToScreen = () => {
    if (!canvasRef.current || Object.keys(nodePositions).length === 0) return

    const canvas = canvasRef.current
    const positions = Object.values(nodePositions)

    if (positions.length === 0) return

    const minX = Math.min(...positions.map((p) => p.x)) - nodeWidth
    const maxX = Math.max(...positions.map((p) => p.x)) + nodeWidth
    const minY = Math.min(...positions.map((p) => p.y)) - nodeHeight
    const maxY = Math.max(...positions.map((p) => p.y)) + nodeHeight

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    const scaleX = (canvas.width - 100) / contentWidth
    const scaleY = (canvas.height - 100) / contentHeight
    const scale = Math.min(scaleX, scaleY, 1)

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    setTransform({
      x: canvas.width / 2 - centerX * scale,
      y: canvas.height / 2 - centerY * scale,
      scale,
    })
  }

  const resetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const canvasPos = screenToCanvas(e.clientX, e.clientY)
    const nodeAtPoint = getNodeAtPoint(canvasPos.x, canvasPos.y)

    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })

    if (tool === "select" && nodeAtPoint) {
      if (e.ctrlKey || e.metaKey) {
        // Multi-select
        setSelectedNodes((prev) => {
          const newSet = new Set(prev)
          if (newSet.has(nodeAtPoint)) {
            newSet.delete(nodeAtPoint)
          } else {
            newSet.add(nodeAtPoint)
          }
          return newSet
        })
      } else {
        // Single select
        setSelectedNodes(new Set([nodeAtPoint]))
      }

      // Start node dragging
      setDraggedNode(nodeAtPoint)
      const nodePos = nodePositions[nodeAtPoint]
      if (nodePos) {
        setDragOffset({
          x: canvasPos.x - nodePos.x,
          y: canvasPos.y - nodePos.y,
        })
      }
    } else if (tool === "select" && !nodeAtPoint) {
      // Clear selection
      setSelectedNodes(new Set())
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    if (draggedNode && tool === "select") {
      // Drag node
      const canvasPos = screenToCanvas(e.clientX, e.clientY)
      setNodePositions((prev) => ({
        ...prev,
        [draggedNode]: {
          x: canvasPos.x - dragOffset.x,
          y: canvasPos.y - dragOffset.y,
        },
      }))
    } else if (tool === "hand" || (tool === "select" && selectedNodes.size === 0 && !draggedNode)) {
      // Pan the canvas
      setTransform((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }))
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDraggedNode(null)
    setDragOffset({ x: 0, y: 0 })
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(3, transform.scale * scaleFactor))

    // Zoom towards mouse position
    const scaleChange = newScale / transform.scale
    setTransform((prev) => ({
      x: mouseX - (mouseX - prev.x) * scaleChange,
      y: mouseY - (mouseY - prev.y) * scaleChange,
      scale: newScale,
    }))
  }

  // Drawing functions
  const drawNode = (
    ctx: CanvasRenderingContext2D,
    pos: NodePosition,
    id: string,
    name: string,
    duration: number,
    earlyStart: number,
    lateStart: number,
    isCritical: boolean,
    isSelected: boolean,
    isHighlighted: boolean,
  ) => {
    // Draw highlight for step-by-step mode
    if (isHighlighted) {
      ctx.strokeStyle = "#f59e0b"
      ctx.lineWidth = 4
      ctx.strokeRect(pos.x - nodeWidth / 2 - 8, pos.y - nodeHeight / 2 - 8, nodeWidth + 16, nodeHeight + 16)
    }

    // Draw selection highlight
    if (isSelected) {
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 3
      ctx.strokeRect(pos.x - nodeWidth / 2 - 5, pos.y - nodeHeight / 2 - 5, nodeWidth + 10, nodeHeight + 10)
    }

    // Draw node background
    ctx.fillStyle = isCritical ? "#fee2e2" : "#f8fafc"
    ctx.strokeStyle = isCritical ? "#dc2626" : "#64748b"
    ctx.lineWidth = isCritical ? 3 : 2

    ctx.fillRect(pos.x - nodeWidth / 2, pos.y - nodeHeight / 2, nodeWidth, nodeHeight)
    ctx.strokeRect(pos.x - nodeWidth / 2, pos.y - nodeHeight / 2, nodeWidth, nodeHeight)

    // Draw internal divisions
    ctx.strokeStyle = "#64748b"
    ctx.lineWidth = 1

    // Vertical line
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y - nodeHeight / 2)
    ctx.lineTo(pos.x, pos.y + nodeHeight / 2)
    ctx.stroke()

    // Horizontal line
    ctx.beginPath()
    ctx.moveTo(pos.x - nodeWidth / 2, pos.y)
    ctx.lineTo(pos.x + nodeWidth / 2, pos.y)
    ctx.stroke()

    // Draw text
    ctx.fillStyle = "#1f2937"
    ctx.font = "bold 14px Arial"
    ctx.textAlign = "center"

    // Task name (top left)
    ctx.fillText(name, pos.x - nodeWidth / 4, pos.y - nodeHeight / 4 + 5)

    // Duration (top right)
    if (id !== "START" && id !== "END") {
      ctx.fillText(duration.toString(), pos.x + nodeWidth / 4, pos.y - nodeHeight / 4 + 5)
    }

    // Early start (bottom left)
    ctx.font = "12px Arial"
    ctx.fillText(earlyStart.toString(), pos.x - nodeWidth / 4, pos.y + nodeHeight / 4)

    // Late start (bottom right)
    ctx.fillText(lateStart.toString(), pos.x + nodeWidth / 4, pos.y + nodeHeight / 4)
  }

  const drawArrow = (ctx: CanvasRenderingContext2D, from: NodePosition, to: NodePosition, isCritical: boolean) => {
    // Calculate connection points on node edges
    const fromX = from.x + nodeWidth / 2
    const fromY = from.y
    const toX = to.x - nodeWidth / 2
    const toY = to.y

    ctx.strokeStyle = isCritical ? "#dc2626" : "#64748b"
    ctx.lineWidth = isCritical ? 3 : 2

    // Draw line
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(toX, toY)
    ctx.stroke()

    // Draw arrowhead
    const angle = Math.atan2(toY - fromY, toX - fromX)
    const arrowLength = 10

    ctx.beginPath()
    ctx.moveTo(toX, toY)
    ctx.lineTo(toX - arrowLength * Math.cos(angle - Math.PI / 6), toY - arrowLength * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(toX, toY)
    ctx.lineTo(toX - arrowLength * Math.cos(angle + Math.PI / 6), toY - arrowLength * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  }

  // Main drawing function
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Set canvas size
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply transform
    ctx.save()
    ctx.translate(transform.x, transform.y)
    ctx.scale(transform.scale, transform.scale)

    if (Object.keys(nodePositions).length === 0) {
      ctx.restore()
      return
    }

    // Draw connections
    tasks.forEach((task) => {
      const taskPos = nodePositions[task.id]
      if (!taskPos) return

      // Draw connections from predecessors
      if (task.predecessors.length === 0) {
        // Connect from START
        const startPos = nodePositions["START"]
        if (startPos) {
          drawArrow(ctx, startPos, taskPos, criticalPath.includes(task.id))
        }
      } else {
        task.predecessors.forEach((predId) => {
          const predPos = nodePositions[predId]
          if (predPos) {
            const isCriticalConnection = criticalPath.includes(predId) && criticalPath.includes(task.id)
            drawArrow(ctx, predPos, taskPos, isCriticalConnection)
          }
        })
      }

      // Check if this task connects to END
      const hasSuccessors = tasks.some((t) => t.predecessors.includes(task.id))
      if (!hasSuccessors) {
        const endPos = nodePositions["END"]
        if (endPos) {
          drawArrow(ctx, taskPos, endPos, criticalPath.includes(task.id))
        }
      }
    })

    // Draw nodes
    const startPos = nodePositions["START"]
    if (startPos) {
      drawNode(
        ctx,
        startPos,
        "START",
        "Début",
        0,
        0,
        0,
        false,
        selectedNodes.has("START"),
        highlightedNodes.includes("START"),
      )
    }

    tasks.forEach((task) => {
      const pos = nodePositions[task.id]
      if (pos) {
        drawNode(
          ctx,
          pos,
          task.id,
          task.name,
          task.duration,
          task.earlyStart,
          task.lateStart,
          task.isCritical,
          selectedNodes.has(task.id),
          highlightedNodes.includes(task.id),
        )
      }
    })

    const endPos = nodePositions["END"]
    if (endPos) {
      drawNode(
        ctx,
        endPos,
        "END",
        "Fin",
        0,
        projectDuration,
        projectDuration,
        true,
        selectedNodes.has("END"),
        highlightedNodes.includes("END"),
      )
    }

    ctx.restore()
  }, [tasks, criticalPath, projectDuration, nodePositions, transform, selectedNodes, highlightedNodes])

  // Fit to screen on initial load
  useEffect(() => {
    if (Object.keys(nodePositions).length > 0) {
      setTimeout(fitToScreen, 100)
    }
  }, [nodePositions])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">MPM Network Diagram</CardTitle>

          {/* Compact Toolbar */}
          <div className="flex items-center space-x-1">
            <Button variant={tool === "select" ? "default" : "outline"} size="sm" onClick={() => setTool("select")}>
              <MousePointer className="h-4 w-4" />
            </Button>
            <Button variant={tool === "hand" ? "default" : "outline"} size="sm" onClick={() => setTool("hand")}>
              <Hand className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-4" />

            <Button variant="outline" size="sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="px-2 py-1 text-xs min-w-[50px]">
              {Math.round(transform.scale * 100)}%
            </Badge>
            <Button variant="outline" size="sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Separator orientation="vertical" className="h-4" />

            <Button variant="outline" size="sm" onClick={fitToScreen}>
              <Maximize className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetView}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col">
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden bg-gray-50"
          style={{
            cursor: tool === "hand" ? "grab" : tool === "move" ? "move" : draggedNode ? "grabbing" : "default",
          }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
        </div>

        {/* Always Visible Legend */}
        <div className="p-3 border-t bg-white flex-shrink-0">
          <div className="flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-gray-500"></div>
              <span>Relation de dépendance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-red-600"></div>
              <span>Chemin critique</span>
            </div>
            {highlightedNodes.length > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-amber-500"></div>
                <span>Étape actuelle</span>
              </div>
            )}
            {selectedNodes.size > 0 && (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-blue-500"></div>
                <span>
                  {selectedNodes.size} sélectionné{selectedNodes.size > 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            <div className="inline-block border rounded p-2">
              <div className="grid grid-cols-2 gap-2 text-left">
                <div>Nom de la tâche</div>
                <div>Durée de la tâche</div>
                <div>Date au plus tôt</div>
                <div>Date au plus tard</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
