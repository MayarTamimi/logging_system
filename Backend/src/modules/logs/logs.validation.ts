import { logInput, logSchema } from "./logs.schema.js"

type rejectedLog = {
    index : number,
    reason : string
}

export function validationLog(logs : any[]) {
    const acceptedLogs : logInput[] = []
    const rejectedLogs : rejectedLog[] = []

    logs.forEach((log , idx) => {
        const res = logSchema.safeParse(log)

        if(res.success) {
            acceptedLogs.push(res.data)
        } else {
            rejectedLogs.push({
                index : idx,
                reason : res.error.issues[0].message
            })
        }
    })

    return {acceptedLogs , rejectedLogs}

}