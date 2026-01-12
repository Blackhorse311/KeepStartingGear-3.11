export interface RouteAction {
    url: string;
    action: (url: string, info: any, sessionID: string, output: string) => Promise<string> | string;
}

export declare class StaticRouterModService {
    registerStaticRouter(name: string, routes: RouteAction[], topLevelRoute: string): void;
}
