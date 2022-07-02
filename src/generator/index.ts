import { VMWriter } from './vm-writer';

export class CodeGenerator {
    private readonly vmWriter: VMWriter;

    constructor() {
        this.vmWriter = new VMWriter();
    }
}
