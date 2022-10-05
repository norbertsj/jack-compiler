import { SHA3 } from 'sha3';

export class Hash {
    static generate(input: string): string {
        const hash = new SHA3(256);
        hash.update(input);
        return hash.digest('hex');
    }
}
