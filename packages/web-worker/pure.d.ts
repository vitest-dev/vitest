type CloneOption = 'native' | 'ponyfill' | 'none';
interface DefineWorkerOptions {
    clone: CloneOption;
}

declare function defineWebWorkers(options?: DefineWorkerOptions): void;

export { defineWebWorkers };
