/**
 * Complete Command Module
 * Handles marking todo items as completed
 * Updates both local and blockchain state
 */
/**
 * Interface for complete command options
 * @interface CompleteOptions
 */
interface CompleteOptions {
    list: string;
    id: string;
}
/**
 * Marks a todo item as completed
 * @param options - Command line options for completing todo
 */
export declare function complete(options: CompleteOptions): Promise<void>;
export default complete;
