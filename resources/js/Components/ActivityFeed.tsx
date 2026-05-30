import { ScrollArea } from "@/Components/ui/scroll-area"
import { Separator } from "@/Components/ui/separator"
import { Clock, User, FileText, AlertCircle } from "lucide-react"

interface Activity {
    id: number;
    description: string;
    event: string;
    causer_id: number;
    causer_type: string;
    created_at: string;
    properties: any;
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
    if (!activities || activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                <Clock className="h-8 w-8 mb-2 opacity-50" />
                <p>No activity recorded yet.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-background/50">
            <div className="space-y-4">
                {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 items-start group">
                        <div className="mt-1 relative">
                            <div className="absolute inset-0 bg-primary/20 blur-sm rounded-full w-2 h-2 m-auto" />
                            <div className="relative h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none flex items-center gap-2">
                                <span className="capitalize text-foreground">{activity.description}</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                    • {new Date(activity.created_at).toLocaleString()}
                                </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {activity.event === 'created' && <span className="text-green-500 font-semibold uppercase text-[10px] mr-1">Created</span>}
                                {activity.event === 'updated' && <span className="text-blue-500 font-semibold uppercase text-[10px] mr-1">Updated</span>}
                                {activity.event === 'deleted' && <span className="text-red-500 font-semibold uppercase text-[10px] mr-1">Deleted</span>}
                            </p>
                            {/* Display changed attributes if available */}
                            {activity.properties?.attributes && (
                                <div className="text-xs bg-muted/40 p-2 rounded mt-1 font-mono text-muted-foreground">
                                    {Object.keys(activity.properties.attributes).map((key) => {
                                        // Don't show large text fields or internal IDs usually
                                        if (['updated_at', 'created_at'].includes(key)) return null;
                                        return (
                                            <div key={key} className="flex gap-1">
                                                <span className="font-semibold">{key}:</span>
                                                <span className="truncate max-w-[200px]">{JSON.stringify(activity.properties.attributes[key])}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    )
}
