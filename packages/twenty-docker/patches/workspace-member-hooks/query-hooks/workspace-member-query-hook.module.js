"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WorkspaceMemberQueryHookModule", {
    enumerable: true,
    get: function() {
        return WorkspaceMemberQueryHookModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _userworkspaceentity = require("../../../engine/core-modules/user-workspace/user-workspace.entity");
const _userworkspacemodule = require("../../../engine/core-modules/user-workspace/user-workspace.module");
const _aihistorymodule = require("../../../engine/metadata-modules/ai/ai-history/ai-history.module");
const _recordshareownershiptransfermodule = require("../../../engine/core-modules/record-share/record-share-ownership-transfer.module");
const _connectedaccountmetadatamodule = require("../../../engine/metadata-modules/connected-account/connected-account-metadata.module");
const _workspacemembercreatemanyprequeryhook = require("./workspace-member-create-many.pre-query.hook");
const _workspacemembercreateoneprequeryhook = require("./workspace-member-create-one.pre-query.hook");
const _workspacememberdeletemanyprequeryhook = require("./workspace-member-delete-many.pre-query.hook");
const _workspacememberdeleteonepostqueryhook = require("./workspace-member-delete-one.post-query.hook");
const _workspacememberdeleteoneprequeryhook = require("./workspace-member-delete-one.pre-query.hook");
const _workspacememberdestroymanyprequeryhook = require("./workspace-member-destroy-many.pre-query.hook");
const _workspacememberdestroyoneprequeryhook = require("./workspace-member-destroy-one.pre-query.hook");
const _workspacememberrestoremanyprequeryhook = require("./workspace-member-restore-many.pre-query.hook");
const _workspacememberrestoreoneprequeryhook = require("./workspace-member-restore-one.pre-query.hook");
const _workspacememberupdatemanyprequeryhook = require("./workspace-member-update-many.pre-query.hook");
const _workspacecachemodule = require("../../../engine/workspace-cache/workspace-cache.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let WorkspaceMemberQueryHookModule = class WorkspaceMemberQueryHookModule {
};
WorkspaceMemberQueryHookModule = _ts_decorate([
    (0, _common.Module)({
        providers: [
            _workspacemembercreateoneprequeryhook.WorkspaceMemberCreateOnePreQueryHook,
            _workspacemembercreatemanyprequeryhook.WorkspaceMemberCreateManyPreQueryHook,
            _workspacememberdeleteoneprequeryhook.WorkspaceMemberDeleteOnePreQueryHook,
            _workspacememberdeleteonepostqueryhook.WorkspaceMemberDeleteOnePostQueryHook,
            _workspacememberdeletemanyprequeryhook.WorkspaceMemberDeleteManyPreQueryHook,
            _workspacememberdestroyoneprequeryhook.WorkspaceMemberDestroyOnePreQueryHook,
            _workspacememberdestroymanyprequeryhook.WorkspaceMemberDestroyManyPreQueryHook,
            _workspacememberrestoreoneprequeryhook.WorkspaceMemberRestoreOnePreQueryHook,
            _workspacememberrestoremanyprequeryhook.WorkspaceMemberRestoreManyPreQueryHook,
            _workspacememberupdatemanyprequeryhook.WorkspaceMemberUpdateManyPreQueryHook
        ],
        imports: [
            _userworkspacemodule.UserWorkspaceModule,
            _connectedaccountmetadatamodule.ConnectedAccountMetadataModule,
            _recordshareownershiptransfermodule.RecordShareOwnershipTransferModule,
            _aihistorymodule.AgentHistoryModule,
            _workspacecachemodule.WorkspaceCacheModule,
            _typeorm.TypeOrmModule.forFeature([
                _userworkspaceentity.UserWorkspaceEntity
            ])
        ]
    })
], WorkspaceMemberQueryHookModule);

//# sourceMappingURL=workspace-member-query-hook.module.js.map