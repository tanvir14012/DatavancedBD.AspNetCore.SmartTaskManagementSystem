/**
 * Facade pattern interfaces
 */

export interface IFacade {
  dispose(): void;
}

export interface IServiceFacade extends IFacade {
  // Base interface for service facades
}

export interface ISignalFacade extends IFacade {
  // Base interface for signal facades
}

export interface IRxJSFacade extends IFacade {
  // Base interface for RxJS facades
}
