import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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

interface ResultsTableProps {
  tasks: CalculatedTask[]
}

export default function ResultsTable({ tasks }: ResultsTableProps) {
  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Predecessors</TableHead>
              <TableHead>Early Start</TableHead>
              <TableHead>Early Finish</TableHead>
              <TableHead>Late Start</TableHead>
              <TableHead>Late Finish</TableHead>
              <TableHead>Total Float</TableHead>
              <TableHead>Critical Path</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className={task.isCritical ? "bg-red-50" : ""}>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell>{task.duration}</TableCell>
                <TableCell>
                  {task.predecessors.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {task.predecessors.map((pred) => (
                        <Badge key={pred} variant="outline" className="text-xs">
                          {pred}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{task.earlyStart}</TableCell>
                <TableCell>{task.earlyFinish}</TableCell>
                <TableCell>{task.lateStart}</TableCell>
                <TableCell>{task.lateFinish}</TableCell>
                <TableCell>
                  <Badge variant={task.totalFloat === 0 ? "destructive" : "secondary"}>{task.totalFloat}</Badge>
                </TableCell>
                <TableCell>
                  {task.isCritical ? <Badge variant="destructive">Yes</Badge> : <Badge variant="outline">No</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
